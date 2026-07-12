import { NextRequest } from "next/server";

import { addDays } from "@/lib/listing-retention";
import { REPORT_REASON_LABELS } from "@/lib/report-labels";
import { getSiteUrl } from "@/lib/seo";
import { getClientIp, getUserAgent, hashIp, hashValue } from "@/lib/security/request";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AdminNotificationRecord,
  ListingReportActionTaken,
  ListingReportRecord,
  ListingReportReason,
  ListingReportSeverity,
  ListingReportStats,
  ListingReportStatus,
  ListingStatus
} from "@/lib/types";
import { recordListingEvent } from "@/modules/analytics/analytics.service";
import { getPublicListingById, updateListing } from "@/modules/listings/listing.repository";
import { sendAgentReportResponseRequestEmail, sendListingReportAdminAlertEmail } from "@/modules/email/email.service";
import {
  AdminReportQuery,
  AdminReportUpdateInput,
  PublicListingReportInput,
  adminReportQuerySchema,
  adminReportUpdateSchema,
  publicListingReportSchema
} from "@/modules/reports/report.schema";

type ReportRow = {
  id: string;
  listing_id: string;
  reporter_user_id: string | null;
  reporter_name?: string | null;
  reporter_email?: string | null;
  reporter_phone?: string | null;
  reason: ListingReportReason;
  details: string | null;
  status: ListingReportStatus;
  severity?: ListingReportSeverity | null;
  admin_notes?: string | null;
  resolution_notes?: string | null;
  reviewed_at?: string | null;
  resolved_at?: string | null;
  assigned_admin_id?: string | null;
  action_taken?: ListingReportActionTaken | null;
  created_at: string;
  updated_at: string;
};

type ListingSummaryRow = {
  id: string;
  agent_id: string;
  title: string;
  status: ListingStatus;
  availability: ListingReportRecord["listingAvailability"];
};

type UserSummaryRow = {
  id: string;
  full_name: string;
  email: string;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: AdminNotificationRecord["priority"];
  entity_type: string;
  entity_id: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

export class ReportConflictError extends Error {
  status = 409;
}

function severityForReason(reason: ListingReportReason): ListingReportSeverity {
  if (["scam", "payment_request", "impersonation", "unsafe_agent"].includes(reason)) {
    return "critical";
  }
  if (reason === "fake") {
    return "high";
  }
  if (reason === "other") {
    return "low";
  }
  return "medium";
}

function isHighRisk(severity: ListingReportSeverity) {
  return severity === "high" || severity === "critical";
}

function toReportRecord(
  row: ReportRow,
  listing?: ListingSummaryRow | null,
  agent?: UserSummaryRow | null
): ListingReportRecord {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: listing?.title ?? null,
    listingStatus: listing?.status ?? null,
    listingAvailability: listing?.availability ?? null,
    agentId: listing?.agent_id ?? null,
    agentName: agent?.full_name ?? null,
    agentEmail: agent?.email ?? null,
    reporterUserId: row.reporter_user_id,
    reporterName: row.reporter_name ?? null,
    reporterEmail: row.reporter_email ?? null,
    reporterPhone: row.reporter_phone ?? null,
    reason: row.reason,
    details: row.details ?? "",
    status: row.status,
    severity: row.severity ?? severityForReason(row.reason),
    adminNotes: row.admin_notes ?? null,
    resolutionNotes: row.resolution_notes ?? null,
    reviewedAt: row.reviewed_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    assignedAdminId: row.assigned_admin_id ?? null,
    actionTaken: row.action_taken ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toAdminNotification(row: NotificationRow): AdminNotificationRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    priority: row.priority,
    entityType: row.entity_type,
    entityId: row.entity_id,
    href: row.href,
    isRead: row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at
  };
}

async function enrichReports(rows: ReportRow[]) {
  if (!rows.length) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const listingIds = Array.from(new Set(rows.map((row) => row.listing_id)));
  const { data: listings } = await supabase
    .from("listings")
    .select("id, agent_id, title, status, availability")
    .in("id", listingIds);

  const listingMap = new Map((listings ?? []).map((listing) => [listing.id, listing as ListingSummaryRow]));
  const agentIds = Array.from(new Set((listings ?? []).map((listing) => listing.agent_id).filter(Boolean)));
  const { data: agents } = agentIds.length
    ? await supabase.from("users").select("id, full_name, email").in("id", agentIds)
    : { data: [] };
  const agentMap = new Map((agents ?? []).map((agent) => [agent.id, agent as UserSummaryRow]));

  return rows.map((row) => {
    const listing = listingMap.get(row.listing_id) ?? null;
    return toReportRecord(row, listing, listing ? agentMap.get(listing.agent_id) ?? null : null);
  });
}

function reportFingerprint(input: {
  listingId: string;
  reason: ListingReportReason;
  userId?: string | null;
  ipHash: string;
  userAgent: string;
  reporterEmail?: string | null;
  reporterPhone?: string | null;
}) {
  const subject = input.userId
    ? `user:${input.userId}`
    : `anon:${input.ipHash}:${hashValue(input.userAgent)}:${hashValue(input.reporterEmail || input.reporterPhone || "no-contact")}`;
  return hashValue(`${input.listingId}:${input.reason}:${subject}`);
}

async function createAdminNotification(input: {
  title: string;
  message: string;
  priority: AdminNotificationRecord["priority"];
  entityId: string;
  href: string;
  type?: string;
}) {
  const supabase = createServerSupabaseClient();
  await supabase.from("admin_notifications").insert({
    type: input.type ?? "listing_report",
    title: input.title,
    message: input.message,
    priority: input.priority,
    entity_type: "listing_report",
    entity_id: input.entityId,
    href: input.href,
    is_read: false
  });
}

export async function createListingReport(input: {
  listingId: string;
  reporterUserId?: string | null;
  request: NextRequest;
  body: unknown;
}) {
  const payload: PublicListingReportInput = publicListingReportSchema.parse(input.body);
  const listing = await getPublicListingById(input.listingId);
  if (!listing) {
    throw new Error("This listing is not available for public reporting.");
  }

  const ipHash = hashIp(getClientIp(input.request));
  const userAgent = getUserAgent(input.request);
  const reporterContactHash = payload.reporterEmail || payload.reporterPhone
    ? hashValue(`${payload.reporterEmail ?? ""}:${payload.reporterPhone ?? ""}`)
    : null;
  const duplicateFingerprint = reportFingerprint({
    listingId: input.listingId,
    reason: payload.reason,
    userId: input.reporterUserId,
    ipHash,
    userAgent,
    reporterEmail: payload.reporterEmail,
    reporterPhone: payload.reporterPhone
  });
  const severity = severityForReason(payload.reason);
  const supabase = createServerSupabaseClient();

  const { data: existing } = await supabase
    .from("listing_reports")
    .select("id")
    .eq("duplicate_fingerprint", duplicateFingerprint)
    .not("status", "in", '("dismissed","resolved")')
    .maybeSingle();

  if (existing) {
    throw new ReportConflictError("We already received this report and our admin team will review it.");
  }

  const { count: existingReportCount } = await supabase
    .from("listing_reports")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", input.listingId);

  const { data, error } = await supabase
    .from("listing_reports")
    .insert({
      listing_id: input.listingId,
      reporter_user_id: input.reporterUserId ?? null,
      reporter_name: payload.reporterName ?? null,
      reporter_email: payload.reporterEmail ?? null,
      reporter_phone: payload.reporterPhone ?? null,
      reporter_contact_hash: reporterContactHash,
      reporter_fingerprint: duplicateFingerprint,
      duplicate_fingerprint: duplicateFingerprint,
      ip_hash: ipHash,
      user_agent: userAgent,
      reason: payload.reason,
      details: payload.details,
      severity,
      status: "open"
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not submit report.");
  }

  await recordListingEvent({
    listingId: input.listingId,
    eventType: "report",
    ipHash
  }).catch(() => undefined);

  const [report] = await enrichReports([data as ReportRow]);
  const href = `/admin/reports?reportId=${report.id}`;
  const priority = severity === "critical" ? "critical" : isHighRisk(severity) ? "high" : "normal";

  await createAdminNotification({
    title: isHighRisk(severity) ? "High-risk listing report" : "New listing report",
    message: `${REPORT_REASON_LABELS[payload.reason]} reported for "${listing.title}".`,
    priority,
    entityId: report.id,
    href
  }).catch(() => undefined);

  if (isHighRisk(severity) || (existingReportCount ?? 0) === 0) {
    await sendListingReportAdminAlertEmail(report).catch(() => undefined);
  }

  return report;
}

export async function listReportsForAdmin(input: unknown = {}) {
  const query: AdminReportQuery = adminReportQuerySchema.parse(input);
  const supabase = createServerSupabaseClient();
  let request = supabase
    .from("listing_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(query.limit ?? 50);

  if (query.status && query.status !== "all" && query.status !== "high_risk") {
    request = request.eq("status", query.status);
  }
  if (query.status === "high_risk") {
    request = request.in("severity", ["high", "critical"]).not("status", "in", '("dismissed","resolved")');
  }
  if (query.listingId) {
    request = request.eq("listing_id", query.listingId);
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(error.message);
  }

  let reports = await enrichReports((data ?? []) as ReportRow[]);
  if (query.agentId) {
    reports = reports.filter((report) => report.agentId === query.agentId);
  }
  return reports;
}

export async function getReportStatsForAdmin(): Promise<ListingReportStats> {
  const supabase = createServerSupabaseClient();
  const reports = await listReportsForAdmin({ limit: 12 });
  const [{ count: openReports }, { count: highRiskReports }, { count: needsReview }] = await Promise.all([
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .in("severity", ["high", "critical"])
      .not("status", "in", '("dismissed","resolved")'),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "reviewing", "reviewed"])
  ]);

  return {
    openReports: openReports ?? 0,
    highRiskReports: highRiskReports ?? 0,
    needsReview: needsReview ?? 0,
    recentReports: reports.slice(0, 6)
  };
}

export async function getReportForAdmin(reportId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("listing_reports").select("*").eq("id", reportId).single();
  if (error || !data) {
    return null;
  }
  const [report] = await enrichReports([data as ReportRow]);
  return report ?? null;
}

export async function updateReportForAdmin(reportId: string, adminId: string, input: unknown) {
  const payload: AdminReportUpdateInput = adminReportUpdateSchema.parse(input);
  const current = await getReportForAdmin(reportId);
  if (!current) {
    throw new Error("Report not found.");
  }

  const now = new Date().toISOString();
  let actionTaken: ListingReportActionTaken | null = null;
  const updates: Record<string, unknown> = {
    assigned_admin_id: adminId,
    updated_at: now
  };

  if (payload.status) {
    updates.status = payload.status;
    if (payload.status === "reviewing") {
      updates.reviewed_at = current.reviewedAt ?? now;
    }
    if (payload.status === "resolved" || payload.status === "dismissed") {
      updates.resolved_at = current.resolvedAt ?? now;
    }
  }
  if (payload.adminNotes !== undefined) updates.admin_notes = payload.adminNotes;
  if (payload.resolutionNotes !== undefined) updates.resolution_notes = payload.resolutionNotes;

  if (payload.legalHoldListing && current.listingId) {
    await updateListing(current.listingId, { legalHoldUntil: addDays(new Date(), 180).toISOString() });
    actionTaken = "other";
  }
  if (payload.hideListing && current.listingId) {
    await updateListing(current.listingId, {
      status: "blocked",
      legalHoldUntil: addDays(new Date(), 180).toISOString()
    });
    actionTaken = "listing_hidden";
  }
  if (payload.blockAgent && current.agentId) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("agents").update({ is_blocked: true }).eq("id", current.agentId);
    if (error) {
      throw new Error(error.message);
    }
    actionTaken = "agent_blocked";
  }
  if (payload.requestAgentResponseMessage && current.agentId) {
    await sendAgentReportResponseRequestEmail(current, payload.requestAgentResponseMessage);
    actionTaken = "agent_contacted";
  }

  if (actionTaken) {
    updates.action_taken = actionTaken;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listing_reports")
    .update(updates)
    .eq("id", reportId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update report.");
  }

  const [report] = await enrichReports([data as ReportRow]);
  return report;
}

export async function listAdminNotifications(limit = 20) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }
  return ((data ?? []) as NotificationRow[]).map(toAdminNotification);
}

export async function markAdminNotificationRead(notificationId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("admin_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update notification.");
  }
  return toAdminNotification(data as NotificationRow);
}

export function reportAdminHref(reportId: string) {
  return new URL(`/admin/reports?reportId=${reportId}`, getSiteUrl()).toString();
}
