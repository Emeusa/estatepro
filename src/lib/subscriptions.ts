import { getActiveListingLimit } from "@/lib/pricing";
import { SubscriptionRecord } from "@/lib/types";

export function isSubscriptionCurrentlyActive(subscription?: SubscriptionRecord | null) {
  if (!subscription?.isActive) {
    return false;
  }

  if (["cancelled", "inactive", "past_due"].includes(subscription.status)) {
    return false;
  }

  if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd).getTime() <= Date.now()) {
    return false;
  }

  return true;
}

export function getEffectivePlanSlug(subscription?: SubscriptionRecord | null) {
  return subscription && isSubscriptionCurrentlyActive(subscription) ? subscription.planSlug : "free_starter";
}

export function getEffectiveActiveListingLimit(subscription?: SubscriptionRecord | null) {
  return getActiveListingLimit(getEffectivePlanSlug(subscription));
}
