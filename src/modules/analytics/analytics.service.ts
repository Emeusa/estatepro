import { createHash } from "crypto";

import { getPlanAnalyticsLevel } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEffectivePlanSlug } from "@/lib/subscriptions";
import { AgentAnalyticsSummary, SubscriptionRecord } from "@/lib/types";
import { getAgentProfile } from "@/modules/agents/agent.repository";

type AnalyticsRange = "7d" | "30d";
type MetricRow = {
  listing_views: number;
  detail_views: number;
  whatsapp_clicks: number;
  phone_clicks: number;
  saves: number;
  reports: number;
};

type EventRow = {
  listing_id: string;
  event_type: "impression" | "detail_view" | "whatsapp_click" | "phone_click" | "save" | "report";
};

function startDateForRange(range: AnalyticsRange) {
  const days = range === "7d" ? 7 : 30;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function hashSession(value?: string | null) {
  if (!value) {
    return null;
  }
  return createHash("sha256").update(value).digest("hex");
}

export async function getAgentAnalytics(
  agentId: string,
  range: AnalyticsRange = "30d",
  subscriptionOverride?: SubscriptionRecord | null
): Promise<AgentAnalyticsSummary> {
  const supabase = createServerSupabaseClient();
  const subscription =
    subscriptionOverride === undefined ? (await getAgentProfile(agentId)).subscription : subscriptionOverride;
  const analyticsLevel = getPlanAnalyticsLevel(getEffectivePlanSlug(subscription));
  const startDate = startDateForRange(range);

  const { data: metricRows } = await supabase
    .from("agent_daily_metrics")
    .select("listing_views, detail_views, whatsapp_clicks, phone_clicks, saves, reports")
    .eq("agent_id", agentId)
    .gte("metric_date", startDate);

  const totals = ((metricRows ?? []) as MetricRow[]).reduce(
    (sum, row) => ({
      listingViews: sum.listingViews + row.listing_views,
      detailViews: sum.detailViews + row.detail_views,
      whatsappClicks: sum.whatsappClicks + row.whatsapp_clicks,
      phoneClicks: sum.phoneClicks + row.phone_clicks,
      saves: sum.saves + row.saves,
      reports: sum.reports + row.reports
    }),
    { listingViews: 0, detailViews: 0, whatsappClicks: 0, phoneClicks: 0, saves: 0, reports: 0 }
  );

  if (analyticsLevel !== "advanced") {
    return { range, analyticsLevel, totals, listings: [] };
  }

  const { data: eventRows } = await supabase
    .from("listing_events")
    .select("listing_id, event_type")
    .eq("agent_id", agentId)
    .gte("created_at", `${startDate}T00:00:00.000Z`)
    .limit(5000);

  const perListing = new Map<
    string,
    { listingId: string; title: string; impressions: number; detailViews: number; whatsappClicks: number; phoneClicks: number }
  >();
  const listingIds = Array.from(new Set(((eventRows ?? []) as EventRow[]).map((event) => event.listing_id)));
  const { data: listings } = listingIds.length
    ? await supabase.from("listings").select("id, title").in("id", listingIds)
    : { data: [] };
  const titles = new Map((listings ?? []).map((listing) => [listing.id, listing.title]));

  for (const event of (eventRows ?? []) as EventRow[]) {
    const current =
      perListing.get(event.listing_id) ??
      {
        listingId: event.listing_id,
        title: titles.get(event.listing_id) ?? "Listing",
        impressions: 0,
        detailViews: 0,
        whatsappClicks: 0,
        phoneClicks: 0
      };
    if (event.event_type === "impression") current.impressions += 1;
    if (event.event_type === "detail_view") current.detailViews += 1;
    if (event.event_type === "whatsapp_click") current.whatsappClicks += 1;
    if (event.event_type === "phone_click") current.phoneClicks += 1;
    perListing.set(event.listing_id, current);
  }

  return {
    range,
    analyticsLevel,
    totals,
    listings: Array.from(perListing.values())
      .sort((first, second) => second.detailViews + second.whatsappClicks + second.phoneClicks - (first.detailViews + first.whatsappClicks + first.phoneClicks))
      .slice(0, 10)
  };
}

export async function recordListingEvent(input: {
  listingId: string;
  eventType: "impression" | "detail_view" | "whatsapp_click" | "phone_click" | "save" | "report";
  sessionId?: string | null;
  ipHash?: string | null;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc("record_listing_event", {
    p_listing_id: input.listingId,
    p_event_type: input.eventType,
    p_session_hash: hashSession(input.sessionId),
    p_ip_hash: input.ipHash ?? null,
    p_metadata: {}
  });

  if (error) {
    throw new Error(error.message);
  }
}
