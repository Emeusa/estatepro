import { getPricingPlan, isPaidPricingPlanSlug } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { captureServerError } from "@/lib/security/logger";
import { isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { toSubscriptionRecord } from "@/lib/supabase-mappers";
import { reconcileAgentListingsForPlan } from "@/modules/listings/listing-plan-reconciliation.service";
import { revalidateListingMutationPaths } from "@/modules/listings/listing-cache";
import { runListingRetentionMaintenance } from "@/modules/listings/listing-retention.service";
import { sendPlanDowngradedEmail, sendSubscriptionExpiryReminderEmail } from "@/modules/email/email.service";

type SubscriptionRow = Parameters<typeof toSubscriptionRecord>[0];

function isDue(listing: { created_at: string; boosted_at?: string | null; last_refreshed_at?: string | null }, days: number) {
  const latest = [listing.last_refreshed_at, listing.boosted_at, listing.created_at]
    .filter(Boolean)
    .sort((first, second) => new Date(second as string).getTime() - new Date(first as string).getTime())[0];
  return Date.now() - new Date(latest as string).getTime() >= days * 24 * 60 * 60 * 1000;
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export async function refreshEligibleListings() {
  const supabase = createServerSupabaseClient();
  let refreshed = 0;
  let demoted = 0;
  let reactivated = 0;
  let subscriptionReminders = 0;
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data: subscriptionRows, error } = await supabase
      .from("subscriptions")
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (subscriptionRows ?? []) as SubscriptionRow[];
    if (!rows.length) {
      break;
    }

    for (const row of rows) {
      const subscription = toSubscriptionRecord(row);
      try {
        const limitResult = await reconcileAgentListingsForPlan(subscription.agentId, subscription);
        demoted += limitResult.demotedListings;
        reactivated += limitResult.activatedListings;
        if (limitResult.demotedListings > 0) {
          await sendPlanDowngradedEmail({
            agentId: subscription.agentId,
            activeListingLimit: limitResult.activeListingLimit,
            demotedListings: limitResult.demotedListings
          });
        }
      } catch (error) {
        captureServerError(error, {
          service: "auto_refresh",
          operation: "listing_plan_reconciliation",
          agentId: subscription.agentId,
          planSlug: subscription.planSlug
        });
      }

      if (!isSubscriptionCurrentlyActive(subscription) || !isPaidPricingPlanSlug(subscription.planSlug)) {
        continue;
      }

      if (subscription.currentPeriodEnd) {
        const remaining = daysUntil(subscription.currentPeriodEnd);
        if ([7, 3, 1].includes(remaining)) {
          await sendSubscriptionExpiryReminderEmail({
            agentId: subscription.agentId,
            planSlug: subscription.planSlug,
            daysUntilExpiry: remaining,
            periodEnd: subscription.currentPeriodEnd
          });
          subscriptionReminders += 1;
        }
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

    if (rows.length < pageSize) {
      break;
    }
  }

  const retention = await runListingRetentionMaintenance();
  if (
    refreshed > 0 ||
    demoted > 0 ||
    reactivated > 0 ||
    Object.values(retention).some((value) => typeof value === "number" && value > 0)
  ) {
    revalidateListingMutationPaths();
  }
  return { refreshed, demoted, reactivated, subscriptionReminders, ...retention };
}
