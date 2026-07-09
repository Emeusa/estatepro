import { getPricingPlan, isPaidPricingPlanSlug } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { toSubscriptionRecord } from "@/lib/supabase-mappers";

type SubscriptionRow = Parameters<typeof toSubscriptionRecord>[0];

function isDue(listing: { created_at: string; boosted_at?: string | null; last_refreshed_at?: string | null }, days: number) {
  const latest = [listing.last_refreshed_at, listing.boosted_at, listing.created_at]
    .filter(Boolean)
    .sort((first, second) => new Date(second as string).getTime() - new Date(first as string).getTime())[0];
  return Date.now() - new Date(latest as string).getTime() >= days * 24 * 60 * 60 * 1000;
}

export async function refreshEligibleListings() {
  const supabase = createServerSupabaseClient();
  const { data: subscriptionRows, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("is_active", true)
    .in("status", ["active", "trialing"])
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  let refreshed = 0;
  for (const row of (subscriptionRows ?? []) as SubscriptionRow[]) {
    const subscription = toSubscriptionRecord(row);
    if (!isSubscriptionCurrentlyActive(subscription) || !isPaidPricingPlanSlug(subscription.planSlug)) {
      continue;
    }

    const plan = getPricingPlan(subscription.planSlug);
    if (!plan.autoRefreshDays) {
      continue;
    }

    const { data: listings } = await supabase
      .from("listings")
      .select("id, created_at, boosted_at, last_refreshed_at")
      .eq("agent_id", subscription.agentId)
      .eq("status", "active")
      .eq("availability", "available")
      .limit(250);

    const dueIds = (listings ?? [])
      .filter((listing) => isDue(listing, plan.autoRefreshDays as number))
      .map((listing) => listing.id);

    if (!dueIds.length) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("listings")
      .update({ last_refreshed_at: new Date().toISOString() })
      .in("id", dueIds);

    if (!updateError) {
      refreshed += dueIds.length;
    }
  }

  return { refreshed };
}
