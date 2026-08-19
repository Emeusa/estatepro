import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SeoIndexingStatusRecord } from "@/lib/types";

export type SeoIndexTargetInput = {
  path: string;
  pageFamily: SeoIndexingStatusRecord["pageFamily"];
  inSitemap: boolean;
  lastModifiedAt: string | null;
};

type SeoIndexingRow = {
  path: string;
  page_family: SeoIndexingStatusRecord["pageFamily"];
  is_eligible: boolean;
  in_sitemap: boolean;
  eligible_at: string;
  last_modified_at: string | null;
  last_inspected_at: string | null;
  next_inspection_at: string | null;
  google_verdict: string | null;
  google_indexed: boolean;
  coverage_state: string | null;
  robots_txt_state: string | null;
  indexing_state: string | null;
  page_fetch_state: string | null;
  last_crawl_time: string | null;
  user_canonical: string | null;
  google_canonical: string | null;
  technical_issue: boolean;
  last_error: string | null;
  technical_alerted_at: string | null;
  delayed_alerted_at: string | null;
};

function isMissingSeoIndexingTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "PGRST205" ||
    (/seo_indexing_status/i.test(error?.message ?? "") && /does not exist|schema cache|not found/i.test(error?.message ?? ""));
}

function toStatus(row: SeoIndexingRow): SeoIndexingStatusRecord {
  return {
    path: row.path,
    pageFamily: row.page_family,
    isEligible: row.is_eligible,
    inSitemap: row.in_sitemap,
    eligibleAt: row.eligible_at,
    lastModifiedAt: row.last_modified_at,
    lastInspectedAt: row.last_inspected_at,
    nextInspectionAt: row.next_inspection_at,
    googleVerdict: row.google_verdict,
    googleIndexed: row.google_indexed,
    coverageState: row.coverage_state,
    robotsTxtState: row.robots_txt_state,
    indexingState: row.indexing_state,
    pageFetchState: row.page_fetch_state,
    lastCrawlTime: row.last_crawl_time,
    userCanonical: row.user_canonical,
    googleCanonical: row.google_canonical,
    technicalIssue: row.technical_issue,
    lastError: row.last_error
  };
}

const INDEXING_COLUMNS = [
  "path",
  "page_family",
  "is_eligible",
  "in_sitemap",
  "eligible_at",
  "last_modified_at",
  "last_inspected_at",
  "next_inspection_at",
  "google_verdict",
  "google_indexed",
  "coverage_state",
  "robots_txt_state",
  "indexing_state",
  "page_fetch_state",
  "last_crawl_time",
  "user_canonical",
  "google_canonical",
  "technical_issue",
  "last_error",
  "technical_alerted_at",
  "delayed_alerted_at"
].join(", ");

export async function getSeoIndexingStatusesByPath(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (!uniquePaths.length) return new Map<string, SeoIndexingStatusRecord>();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("seo_indexing_status")
    .select(INDEXING_COLUMNS)
    .in("path", uniquePaths);

  if (error) {
    if (isMissingSeoIndexingTable(error)) return new Map<string, SeoIndexingStatusRecord>();
    throw new Error(error.message);
  }

  return new Map(((data ?? []) as unknown as SeoIndexingRow[]).map((row) => [row.path, toStatus(row)]));
}

export async function listSeoIndexingStatuses(limit = 500) {
  const supabase = createServerSupabaseClient();
  const safeLimit = Math.min(1000, Math.max(1, Math.trunc(limit)));
  const { data, error } = await supabase
    .from("seo_indexing_status")
    .select(INDEXING_COLUMNS)
    .eq("is_eligible", true)
    .order("technical_issue", { ascending: false })
    .order("last_inspected_at", { ascending: false, nullsFirst: false })
    .order("eligible_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    if (isMissingSeoIndexingTable(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as SeoIndexingRow[]).map(toStatus);
}

export async function syncSeoIndexTargets(targets: SeoIndexTargetInput[]) {
  const supabase = createServerSupabaseClient();
  const uniqueTargets = [...new Map(targets.map((target) => [target.path, target])).values()];
  if (!uniqueTargets.length) return { synced: 0, retired: 0 };

  const updatedAt = new Date().toISOString();
  for (let start = 0; start < uniqueTargets.length; start += 250) {
    const batch = uniqueTargets.slice(start, start + 250);
    const { error } = await supabase.from("seo_indexing_status").upsert(
      batch.map((target) => ({
        path: target.path,
        page_family: target.pageFamily,
        is_eligible: true,
        in_sitemap: target.inSitemap,
        last_modified_at: target.lastModifiedAt,
        updated_at: updatedAt
      })),
      { onConflict: "path" }
    );

    if (error) {
      if (isMissingSeoIndexingTable(error)) return { synced: 0, retired: 0 };
      throw new Error(error.message);
    }
  }

  const firstInspectionAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  for (let start = 0; start < uniqueTargets.length; start += 250) {
    const paths = uniqueTargets.slice(start, start + 250).map((target) => target.path);
    const { error: scheduleError } = await supabase
      .from("seo_indexing_status")
      .update({ next_inspection_at: firstInspectionAt, updated_at: updatedAt })
      .in("path", paths)
      .eq("is_eligible", true)
      .is("next_inspection_at", null);
    if (scheduleError && !isMissingSeoIndexingTable(scheduleError)) throw new Error(scheduleError.message);
  }

  const activePaths: string[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data: activeRows, error: activeError } = await supabase
      .from("seo_indexing_status")
      .select("path")
      .eq("is_eligible", true)
      .order("path", { ascending: true })
      .range(from, from + 999);
    if (activeError) {
      if (isMissingSeoIndexingTable(activeError)) return { synced: uniqueTargets.length, retired: 0 };
      throw new Error(activeError.message);
    }
    const batch = (activeRows ?? []).map((row) => row.path as string);
    activePaths.push(...batch);
    if (batch.length < 1000) break;
  }

  const currentPaths = new Set(uniqueTargets.map((target) => target.path));
  const stalePaths = activePaths.filter((path) => !currentPaths.has(path));
  let retired = 0;
  for (let start = 0; start < stalePaths.length; start += 250) {
    const batch = stalePaths.slice(start, start + 250);
    const { error: retireError } = await supabase
      .from("seo_indexing_status")
      .update({ is_eligible: false, in_sitemap: false, next_inspection_at: null, updated_at: new Date().toISOString() })
      .in("path", batch);
    if (retireError) throw new Error(retireError.message);
    retired += batch.length;
  }

  return { synced: uniqueTargets.length, retired };
}

export async function listDueSeoIndexTargets(now: Date, limit: number) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("seo_indexing_status")
    .select(INDEXING_COLUMNS)
    .eq("is_eligible", true)
    .lte("next_inspection_at", now.toISOString())
    .order("next_inspection_at", { ascending: true })
    .order("eligible_at", { ascending: true })
    .limit(limit);
  if (error) {
    if (isMissingSeoIndexingTable(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as SeoIndexingRow[]).map((row) => ({
    ...toStatus(row),
    technicalAlertedAt: row.technical_alerted_at,
    delayedAlertedAt: row.delayed_alerted_at
  }));
}

export async function updateSeoIndexInspection(
  path: string,
  input: {
    inspectedAt: string;
    nextInspectionAt: string;
    googleVerdict: string | null;
    googleIndexed: boolean;
    coverageState: string | null;
    robotsTxtState: string | null;
    indexingState: string | null;
    pageFetchState: string | null;
    lastCrawlTime: string | null;
    userCanonical: string | null;
    googleCanonical: string | null;
    technicalIssue: boolean;
    lastError: string | null;
    technicalAlertedAt?: string;
    delayedAlertedAt?: string;
  }
) {
  const supabase = createServerSupabaseClient();
  const updates: Record<string, unknown> = {
    last_inspected_at: input.inspectedAt,
    next_inspection_at: input.nextInspectionAt,
    google_verdict: input.googleVerdict,
    google_indexed: input.googleIndexed,
    coverage_state: input.coverageState,
    robots_txt_state: input.robotsTxtState,
    indexing_state: input.indexingState,
    page_fetch_state: input.pageFetchState,
    last_crawl_time: input.lastCrawlTime,
    user_canonical: input.userCanonical,
    google_canonical: input.googleCanonical,
    technical_issue: input.technicalIssue,
    last_error: input.lastError,
    updated_at: input.inspectedAt
  };
  if (input.technicalAlertedAt) updates.technical_alerted_at = input.technicalAlertedAt;
  if (input.delayedAlertedAt) updates.delayed_alerted_at = input.delayedAlertedAt;
  const { error } = await supabase.from("seo_indexing_status").update(updates).eq("path", path);
  if (error && !isMissingSeoIndexingTable(error)) throw new Error(error.message);
}

export async function createSeoIndexingAdminNotification(input: {
  path: string;
  alertType: "technical" | "delayed";
  title: string;
  message: string;
  priority: "normal" | "high" | "critical";
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("admin_notifications").upsert(
    {
      type: "seo_indexing",
      title: input.title,
      message: input.message,
      priority: input.priority,
      entity_type: "seo_page",
      entity_id: null,
      href: `/admin/seo?path=${encodeURIComponent(input.path)}`,
      dedupe_key: `seo_indexing:${input.alertType}:${input.path}`
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}
