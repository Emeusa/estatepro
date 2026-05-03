import { listingFilterSchema, listingInputSchema } from "@/modules/listings/listing.schema";
import {
  activatePendingListingsForAgent,
  createListing,
  deleteListing,
  getListingById,
  listAgentListings,
  listListingsByAgentIds,
  listListingsForAdmin,
  listPublicListings,
  updateListing
} from "@/modules/listings/listing.repository";

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
  return listing;
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
  const payload = listingInputSchema.parse(input);
  return createListing(agentId, payload);
}

export async function updateAgentListing(listingId: string, input: unknown) {
  const payload = listingInputSchema.partial().parse(input);
  return updateListing(listingId, payload);
}

export async function removeAgentListing(listingId: string) {
  return deleteListing(listingId);
}
