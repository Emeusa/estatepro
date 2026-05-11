import { listingFilterSchema, listingInputSchema, listingUpdateSchema } from "@/modules/listings/listing.schema";
import {
  activatePendingListingsForAgent,
  createListing,
  deleteListing,
  getPublicAgentSummary,
  getListingById,
  listAgentListings,
  listListingsByAgentIds,
  listListingsForAdmin,
  listPublicListings,
  listPublicListingsByAgent,
  updateListing
} from "@/modules/listings/listing.repository";
import { getAgentProfile } from "@/modules/agents/agent.repository";

export async function getPublicListings(input: Record<string, unknown>) {
  return listPublicListings(listingFilterSchema.parse(input));
}

export async function getListingDetails(listingId: string) {
  return getListingById(listingId);
}

export async function getPublicListingDetails(listingId: string) {
  const listing = await getListingById(listingId);
  if (!listing || listing.status !== "active") {
    return null;
  }

  const agent = await getPublicAgentSummary(listing.agentId);
  if (!agent) {
    return null;
  }

  return { listing, agent };
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

export async function approvePendingListingsForAgent(agentId: string) {
  return activatePendingListingsForAgent(agentId);
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

export async function createAgentListing(agentId: string, input: unknown) {
  await ensureAgentCanManageListings(agentId);
  const payload = listingInputSchema.parse(input);
  return createListing(agentId, payload);
}

export async function updateAgentListing(agentId: string, listingId: string, input: unknown) {
  await ensureAgentCanManageListings(agentId);
  const payload = listingUpdateSchema.parse(input);
  return updateListing(listingId, payload);
}

export async function removeAgentListing(agentId: string, listingId: string) {
  await ensureAgentCanManageListings(agentId);
  return deleteListing(listingId);
}
