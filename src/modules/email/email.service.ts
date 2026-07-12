import "server-only";

import { getPricingPlan } from "@/lib/pricing";
import { REPORT_REASON_LABELS } from "@/lib/report-labels";
import { getSiteUrl } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ListingRecord, ListingReportRecord, UserRecord } from "@/lib/types";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { toUserRecord } from "@/lib/supabase-mappers";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: "client" | "agent" | "admin";
  created_at: string;
};

async function getUser(userId: string): Promise<UserRecord | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
  if (error || !data) {
    return null;
  }
  return toUserRecord(data as UserRow);
}

function firstName(user: UserRecord) {
  return user.fullName.split(" ").filter(Boolean)[0] ?? "there";
}

function dashboardUrl(user: UserRecord) {
  const siteUrl = getSiteUrl();
  if (user.role === "agent") {
    return new URL("/agents/dashboard", siteUrl).toString();
  }
  if (user.role === "admin") {
    return new URL("/admin", siteUrl).toString();
  }
  return new URL("/dashboard", siteUrl).toString();
}

function adminAlertEmail() {
  return process.env.ADMIN_ALERT_EMAIL?.trim() || null;
}

export async function sendWelcomeEmailForUser(userId: string) {
  const user = await getUser(userId);
  if (!user) {
    return;
  }

  await sendTransactionalEmail({
    type: "welcome",
    to: user.email,
    userId: user.id,
    eventKey: `welcome:${user.id}`,
    subject: "Welcome to C59 Estatehub",
    heading: `Welcome to C59 Estatehub, ${firstName(user)}`,
    body:
      user.role === "agent"
        ? [
            "Your agent account is ready. If your verification is still pending, our admin team will review your details before your listings can appear publicly.",
            "You can prepare your profile and listings from your dashboard while verification is being completed."
          ]
        : [
            "Your account is ready. You can browse verified property listings, save time while searching, and contact agents faster.",
            "C59 Estatehub is built to make property discovery clearer, safer, and easier."
          ],
    cta: {
      label: "Open dashboard",
      href: dashboardUrl(user)
    },
    metadata: { role: user.role }
  });
}

export async function sendAgentRegistrationReceivedEmail(agentId: string) {
  const user = await getUser(agentId);
  if (!user) {
    return;
  }

  await sendTransactionalEmail({
    type: "agent_registration_received",
    to: user.email,
    userId: user.id,
    eventKey: `agent_registration_received:${user.id}`,
    subject: "We received your agent registration",
    heading: "Your agent registration is under review",
    body: [
      "Thank you for registering as an agent on C59 Estatehub.",
      "Our admin team will review your details. Once approved, your available listings can appear publicly and users will be able to contact you from listing pages."
    ],
    cta: {
      label: "Open agent dashboard",
      href: new URL("/agents/dashboard", getSiteUrl()).toString()
    },
    metadata: { role: user.role }
  });

  const alertEmail = adminAlertEmail();
  if (!alertEmail) {
    return;
  }

  await sendTransactionalEmail({
    type: "admin_alert",
    to: alertEmail,
    userId: user.id,
    eventKey: `admin_alert:agent_registration:${user.id}`,
    subject: "New agent registration needs review",
    heading: "New agent registration",
    body: [
      `${user.fullName} (${user.email}) submitted an agent registration.`,
      "Review the agent details in the admin dashboard before approving public listing visibility."
    ],
    cta: {
      label: "Review agent",
      href: new URL(`/admin/agents/${user.id}`, getSiteUrl()).toString()
    },
    metadata: { agentId: user.id }
  });
}

export async function sendAgentVerificationEmail(agentId: string, status: "approved" | "rejected") {
  const user = await getUser(agentId);
  if (!user) {
    return;
  }

  const approved = status === "approved";
  await sendTransactionalEmail({
    type: approved ? "agent_verification_approved" : "agent_verification_rejected",
    to: user.email,
    userId: user.id,
    eventKey: `agent_verification_${status}:${user.id}`,
    subject: approved ? "Your C59 Estatehub agent account is approved" : "Your C59 Estatehub agent review needs attention",
    heading: approved ? "Your agent account is approved" : "Your agent application was not approved",
    body: approved
      ? [
          "Your agent account has been approved. Active and available listings from your account can now appear on C59 Estatehub.",
          "Keep your listings accurate, available, and well detailed to maintain user trust."
        ]
      : [
          "Your agent application was not approved at this time.",
          "You can contact support if you believe this was a mistake or if you need guidance on what to update."
        ],
    cta: {
      label: approved ? "Open agent dashboard" : "Contact support",
      href: approved
        ? new URL("/agents/dashboard", getSiteUrl()).toString()
        : `mailto:support@${getSiteUrl().hostname.replace(/^www\./, "")}`
    },
    metadata: { verificationStatus: status }
  });
}

export async function sendListingModerationEmail(listing: ListingRecord) {
  if (listing.status !== "active" && listing.status !== "blocked") {
    return;
  }

  const user = await getUser(listing.agentId);
  if (!user) {
    return;
  }

  const active = listing.status === "active";
  await sendTransactionalEmail({
    type: active ? "listing_active" : "listing_rejected",
    to: user.email,
    userId: user.id,
    eventKey: `listing_${listing.status}:${listing.id}`,
    subject: active ? "Your listing is active on C59 Estatehub" : "Your listing needs attention",
    heading: active ? "Your listing is active" : "Your listing was not approved",
    body: active
      ? [
          `"${listing.title}" is now active.`,
          "If the property becomes sold, rented, or booked, update the availability so users do not contact you for unavailable property."
        ]
      : [
          `"${listing.title}" was not approved for public visibility.`,
          "Review the listing details and contact support if you need help understanding the decision."
        ],
    cta: {
      label: "Manage listings",
      href: new URL("/agents/listings", getSiteUrl()).toString()
    },
    metadata: { listingId: listing.id, status: listing.status }
  });
}

export async function sendListingReportAdminAlertEmail(report: ListingReportRecord) {
  const alertEmail = adminAlertEmail();
  if (!alertEmail) {
    return;
  }

  await sendTransactionalEmail({
    type: "admin_alert",
    to: alertEmail,
    eventKey: `admin_alert:listing_report:${report.id}`,
    subject: report.severity === "critical" ? "Critical listing report needs review" : "New listing report needs review",
    heading: "Listing report submitted",
    body: [
      `${REPORT_REASON_LABELS[report.reason]} was reported for "${report.listingTitle ?? "a listing"}".`,
      `Severity: ${report.severity}. Agent: ${report.agentName ?? "Unknown agent"} (${report.agentEmail ?? "No email"}).`,
      "Review the report before taking enforcement action. Reporter contact details must remain private."
    ],
    cta: {
      label: "Review report",
      href: new URL(`/admin/reports?reportId=${report.id}`, getSiteUrl()).toString()
    },
    metadata: {
      reportId: report.id,
      listingId: report.listingId,
      agentId: report.agentId,
      reason: report.reason,
      severity: report.severity
    }
  });
}

export async function sendAgentReportResponseRequestEmail(report: ListingReportRecord, adminMessage: string) {
  if (!report.agentId) {
    return;
  }
  const user = await getUser(report.agentId);
  if (!user) {
    return;
  }

  await sendTransactionalEmail({
    type: "admin_alert",
    to: user.email,
    userId: user.id,
    eventKey: `agent_report_response_request:${report.id}:${new Date().toISOString().slice(0, 10)}`,
    subject: "A listing report needs your response",
    heading: "Please respond to a listing report",
    body: [
      `A user reported "${report.listingTitle ?? "one of your listings"}" for: ${REPORT_REASON_LABELS[report.reason]}.`,
      adminMessage,
      "Do not contact or attempt to identify the reporter. Reply through support/admin channels with accurate evidence or corrections."
    ],
    cta: {
      label: "Open your listings",
      href: new URL("/agents/listings", getSiteUrl()).toString()
    },
    metadata: {
      reportId: report.id,
      listingId: report.listingId,
      reason: report.reason
    }
  });
}

export async function sendSubscriptionActivatedEmail(input: {
  agentId: string;
  planSlug: string;
  provider: string;
  reference: string;
}) {
  const user = await getUser(input.agentId);
  if (!user) {
    return;
  }

  const plan = getPricingPlan(input.planSlug);
  await sendTransactionalEmail({
    type: "subscription_activated",
    to: user.email,
    userId: user.id,
    eventKey: `subscription_activated:${input.reference}`,
    subject: `${plan.name} is active`,
    heading: "Your subscription is active",
    body: [
      `Your ${plan.name} plan is now active on C59 Estatehub.`,
      "Your plan limits and visibility benefits now apply to your approved, available listings."
    ],
    cta: {
      label: "View subscription",
      href: new URL("/agents/subscription", getSiteUrl()).toString()
    },
    metadata: {
      planSlug: input.planSlug,
      provider: input.provider,
      reference: input.reference
    }
  });
}

export async function sendSubscriptionFailedEmail(agentId: string) {
  const user = await getUser(agentId);
  if (!user) {
    return;
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  await sendTransactionalEmail({
    type: "subscription_failed",
    to: user.email,
    userId: user.id,
    eventKey: `subscription_failed:${agentId}:${dateKey}`,
    subject: "Subscription payment failed",
    heading: "Your subscription payment failed",
    body: [
      "We could not confirm your latest subscription payment.",
      "Please check your billing status from your dashboard to avoid losing paid visibility benefits."
    ],
    cta: {
      label: "Open subscription",
      href: new URL("/agents/subscription", getSiteUrl()).toString()
    }
  });
}

export async function sendSubscriptionCancelledEmail(agentId: string) {
  const user = await getUser(agentId);
  if (!user) {
    return;
  }

  await sendTransactionalEmail({
    type: "subscription_cancelled",
    to: user.email,
    userId: user.id,
    eventKey: `subscription_cancelled:${agentId}`,
    subject: "Subscription renewal cancelled",
    heading: "Your subscription renewal is cancelled",
    body: [
      "Your paid plan renewal has been cancelled.",
      "Your current benefits may remain available until the end of the active billing period, depending on your payment provider."
    ],
    cta: {
      label: "View subscription",
      href: new URL("/agents/subscription", getSiteUrl()).toString()
    }
  });
}

export async function sendSubscriptionExpiryReminderEmail(input: {
  agentId: string;
  planSlug: string;
  daysUntilExpiry: number;
  periodEnd: string;
}) {
  const user = await getUser(input.agentId);
  if (!user) {
    return;
  }

  const plan = getPricingPlan(input.planSlug);
  await sendTransactionalEmail({
    type: "subscription_expiring",
    to: user.email,
    userId: user.id,
    eventKey: `subscription_expiring:${user.id}:${input.planSlug}:${input.daysUntilExpiry}:${input.periodEnd.slice(0, 10)}`,
    subject: `${plan.name} expires in ${input.daysUntilExpiry} day${input.daysUntilExpiry === 1 ? "" : "s"}`,
    heading: "Your paid visibility is about to expire",
    body: [
      `Your ${plan.name} plan expires on ${new Date(input.periodEnd).toLocaleDateString("en-NG")}.`,
      "If it expires, your account will return to the Free Starter active listing limit and overflow listings will become inactive with scheduled media cleanup."
    ],
    cta: {
      label: "Manage subscription",
      href: new URL("/agents/subscription", getSiteUrl()).toString()
    },
    metadata: input
  });
}

export async function sendPlanDowngradedEmail(input: {
  agentId: string;
  activeListingLimit: number;
  demotedListings: number;
}) {
  const user = await getUser(input.agentId);
  if (!user || input.demotedListings <= 0) {
    return;
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  await sendTransactionalEmail({
    type: "plan_downgraded",
    to: user.email,
    userId: user.id,
    eventKey: `plan_downgraded:${user.id}:${dateKey}`,
    subject: "Some listings were moved inactive",
    heading: "Your listing visibility was adjusted",
    body: [
      `Your current plan allows ${input.activeListingLimit} active available listings.`,
      `${input.demotedListings} overflow listing${input.demotedListings === 1 ? " was" : "s were"} moved inactive. Their images are kept temporarily, but will be removed if the listings are not reactivated before the retention deadline.`
    ],
    cta: {
      label: "Review listings",
      href: new URL("/agents/listings", getSiteUrl()).toString()
    },
    metadata: input
  });
}

export async function sendListingRetentionEmail(input: {
  type:
    | "listing_deactivated"
    | "media_delete_warning"
    | "media_deleted"
    | "hard_delete_warning"
    | "listing_deleted";
  listing: ListingRecord;
  eventKey: string;
  subject: string;
  heading: string;
  body: string[];
}) {
  const user = await getUser(input.listing.agentId);
  if (!user) {
    return;
  }

  await sendTransactionalEmail({
    type: input.type,
    to: user.email,
    userId: user.id,
    eventKey: input.eventKey,
    subject: input.subject,
    heading: input.heading,
    body: input.body,
    cta: {
      label: "Review listings",
      href: new URL("/agents/listings", getSiteUrl()).toString()
    },
    metadata: {
      listingId: input.listing.id,
      title: input.listing.title,
      status: input.listing.status,
      availability: input.listing.availability
    }
  });
}
