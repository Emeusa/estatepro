import { listingFilterSchema, listingInputSchema, listingUpdateSchema } from "@/modules/listings/listing.schema";
import {
  activatePendingListingsForAgent,
  countActiveAvailableListingsForAgent,
  createListing,
  deleteListing,
  demoteExcessActiveAvailableListingsForAgent,
  getPublicAgentSummary,
  getListingById,
  getPublicListingById,
  listAgentListings,
  listListingsByAgentIds,
  listListingCountsByAgentIds,
  listListingsForAdmin,
  listPublicListings,
  listPublicListingsByAgent,
  listSimilarPublicListings,
  updateListing
} from "@/modules/listings/listing.repository";
import { getAgentProfile } from "@/modules/agents/agent.repository";
import { getEffectiveActiveListingLimit } from "@/lib/subscriptions";
import {
  createActiveListingLimitError,
  willConsumeNewActiveAvailableSlot
} from "@/lib/listing-limits";
import type { ListingRecord, SubscriptionRecord } from "@/lib/types";

export async function getPublicListings(input: Record<string, unknown>) {
  return listPublicListings(listingFilterSchema.parse(input));
}

export async function getListingDetails(listingId: string) {
  return getListingById(listingId);
}

export async function getPublicListingDetails(listingId: string) {
  const listing = await getPublicListingById(listingId);
  if (!listing) {
    return null;
  }

  const agent = await getPublicAgentSummary(listing.agentId);
  if (!agent) {
    return null;
  }

  return { listing, agent };
}

export async function getSimilarListingsForPublicListing(listing: ListingRecord, limit = 3) {
  return listSimilarPublicListings(listing, limit);
}

export async function getPublicAgentListings(agentId: string) {
  const [agent, listings] = await Promise.all([
    getPublicAgentSummary(agentId),
    listPublicListingsByAgent(agentId)
  ]);

  if (!agent || !listings.length) {
    return null;
  }

  return { agent, listings };
}

export async function getAgentListings(agentId: string) {
  return listAgentListings(agentId);
}

export async function getListingsForAdmin() {
  return listListingsForAdmin();
}

export async function getListingsByAgentIds(agentIds: string[]) {
  return listListingsByAgentIds(agentIds);
}

export async function getListingCountsByAgentIds(agentIds: string[]) {
  return listListingCountsByAgentIds(agentIds);
}

export async function approvePendingListingsForAgent(agentId: string) {
  const { subscription } = await getAgentProfile(agentId);
  return activatePendingListingsForAgent(agentId, getEffectiveActiveListingLimit(subscription));
}

export async function ensureAgentCanManageListings(agentId: string) {
  const { agent } = await getAgentProfile(agentId);

  if (!agent) {
    throw new Error("Agent profile was not found.");
  }

  if (agent.isBlocked) {
    throw new Error("Your agent account is blocked and cannot manage listings.");
  }

  if (agent.verificationStatus === "rejected") {
    throw new Error("Your agent account was rejected and cannot manage listings.");
  }

  return agent;
}

export async function ensureAgentOwnsListing(agentId: string, listingId: string) {
  const listing = await getListingById(listingId);
  if (!listing) {
    throw new Error("Listing not found.");
  }
  if (listing.agentId !== agentId) {
    throw new Error("You cannot modify another agent's listing.");
  }
  return listing;
}

async function assertCanAddActiveAvailableListing(
  agentId: string,
  activeListingLimit: number,
  excludeListingId?: string
) {
  const activeListings = await countActiveAvailableListingsForAgent(agentId, excludeListingId);
  if (activeListings >= activeListingLimit) {
    throw createActiveListingLimitError(activeListingLimit);
  }
}

export async function enforceAgentActiveListingLimit(
  agentId: string,
  subscriptionOverride?: SubscriptionRecord | null
) {
  const subscription =
    subscriptionOverride === undefined ? (await getAgentProfile(agentId)).subscription : subscriptionOverride;
  return demoteExcessActiveAvailableListingsForAgent(
    agentId,
    getEffectiveActiveListingLimit(subscription)
  );
}

export async function createAgentListing(agentId: string, input: unknown) {
  const { agent, subscription } = await getAgentProfile(agentId);
  if (!agent) {
    throw new Error("Agent profile was not found.");
  }
  if (agent.isBlocked) {
    throw new Error("Your agent account is blocked and cannot manage listings.");
  }
  if (agent.verificationStatus === "rejected") {
    throw new Error("Your agent account was rejected and cannot manage listings.");
  }

  const payload = listingInputSchema.parse(input);
  const initialStatus = agent.verificationStatus === "approved" ? "active" : "pending";

  if (initialStatus === "active" && payload.availability === "available") {
    await assertCanAddActiveAvailableListing(agentId, getEffectiveActiveListingLimit(subscription));
  }

  return createListing(agentId, payload, initialStatus);
}

export async function updateAgentListing(agentId: string, listingId: string, input: unknown) {
  const { agent, subscription } = await getAgentProfile(agentId);
  if (!agent) {
    throw new Error("Agent profile was not found.");
  }
  if (agent.isBlocked) {
    throw new Error("Your agent account is blocked and cannot manage listings.");
  }
  if (agent.verificationStatus === "rejected") {
    throw new Error("Your agent account was rejected and cannot manage listings.");
  }

  const currentListing = await ensureAgentOwnsListing(agentId, listingId);
  const payload = listingUpdateSchema.parse(input);
  if (willConsumeNewActiveAvailableSlot(currentListing, payload)) {
    await assertCanAddActiveAvailableListing(
      agentId,
      getEffectiveActiveListingLimit(subscription),
      listingId
    );
  }

  return updateListing(listingId, payload);
}

export async function removeAgentListing(agentId: string, listingId: string) {
  await ensureAgentCanManageListings(agentId);
  await ensureAgentOwnsListing(agentId, listingId);
  return deleteListing(listingId);
}
