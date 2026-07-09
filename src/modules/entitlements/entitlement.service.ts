import {
  getActiveListingLimit,
  getPlanAnalyticsLevel,
  getPricingPlan,
  hasPriorityReview,
  hasPrioritySupport,
  isPaidPricingPlanSlug
} from "@/lib/pricing";
import { getEffectivePlanSlug, isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { AgentEntitlements, SubscriptionRecord } from "@/lib/types";
import {
  countActiveAvailableListings,
  emptyCreditMap,
  grantPlanPromotionCredits,
  listCurrentPromotionCredits
} from "@/modules/entitlements/entitlement.repository";

function fallbackPeriodEnd(start: Date) {
  return new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

function getEntitlementPeriod(subscription?: SubscriptionRecord | null) {
  const start = subscription?.currentPeriodStart ?? subscription?.trialStartsAt ?? new Date().toISOString();
  const end = subscription?.currentPeriodEnd ?? subscription?.trialEndsAt ?? fallbackPeriodEnd(new Date(start));
  return { start, end };
}

export async function syncAgentPlanCredits(agentId: string, subscription?: SubscriptionRecord | null) {
  if (!subscription || !isSubscriptionCurrentlyActive(subscription)) {
    return;
  }

  const planSlug = getEffectivePlanSlug(subscription);
  if (!isPaidPricingPlanSlug(planSlug)) {
    return;
  }

  const { start, end } = getEntitlementPeriod(subscription);
  await grantPlanPromotionCredits({
    agentId,
    planSlug,
    periodStart: start,
    periodEnd: end
  });
}

export async function getAgentEntitlements(agentId: string, subscription?: SubscriptionRecord | null): Promise<AgentEntitlements> {
  const planSlug = getEffectivePlanSlug(subscription);
  const plan = getPricingPlan(planSlug);
  const { start, end } = getEntitlementPeriod(subscription);

  try {
    await syncAgentPlanCredits(agentId, subscription);
  } catch {
    // The app remains usable before the latest schema is run; promotion actions will surface setup errors.
  }

  const [activeListingCount, credits] = await Promise.all([
    countActiveAvailableListings(agentId).catch(() => 0),
    listCurrentPromotionCredits(agentId).catch(() => emptyCreditMap())
  ]);

  return {
    planSlug: plan.slug,
    planName: plan.name,
    activeListingLimit: getActiveListingLimit(plan.slug),
    activeListingCount,
    autoRefreshDays: plan.autoRefreshDays,
    analyticsLevel: getPlanAnalyticsLevel(plan.slug),
    hasPriorityReview: hasPriorityReview(plan.slug),
    hasPrioritySupport: hasPrioritySupport(plan.slug),
    credits,
    periodStart: start,
    periodEnd: end
  };
}
