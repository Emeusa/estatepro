import { getEffectiveActiveListingLimit } from "@/lib/subscriptions";
import type { SubscriptionRecord } from "@/lib/types";
import { getAgentProfile } from "@/modules/agents/agent.repository";
import {
  demoteExcessActiveAvailableListingsForAgent,
  reactivateEligiblePlanLimitedListingsForAgent
} from "@/modules/listings/listing.repository";

export type ListingLimitReconciliationSummary = {
  activatedListings: number;
  demotedListings: number;
  activeListingLimit: number;
};

export async function reconcileAgentListingsForPlan(
  agentId: string,
  subscriptionOverride?: SubscriptionRecord | null
): Promise<ListingLimitReconciliationSummary> {
  const profile = await getAgentProfile(agentId);
  const subscription = subscriptionOverride === undefined ? profile.subscription : subscriptionOverride;
  const activeListingLimit = getEffectiveActiveListingLimit(subscription);
  const demotion = await demoteExcessActiveAvailableListingsForAgent(agentId, activeListingLimit);

  const canReactivate =
    profile.agent?.verificationStatus === "approved" &&
    !profile.agent.isBlocked;
  const activatedListings = canReactivate
    ? await reactivateEligiblePlanLimitedListingsForAgent(agentId, activeListingLimit)
    : 0;

  return {
    activatedListings,
    demotedListings: demotion.demotedListings,
    activeListingLimit
  };
}
