import { unstable_cache } from "next/cache";

import { listingFilterSchema, listingInputSchema, listingUpdateSchema } from "@/modules/listings/listing.schema";
import {
  activatePendingListingsForAgent,
  buildPublicMarketPageFromRanked,
  countMediaBearingListingsForAgent,
  countActiveAvailableListingsForAgent,
  createListing,
  deleteListing,
  demoteExcessActiveAvailableListingsForAgent,
  getPublicAgentSummary,
  getListingById,
  getPublicListingByIdentifier,
  listAgentListings,
  listAgentListingsPage,
  listListingsByAgentIds,
  listListingCountsByAgentIds,
  listListingsForAdmin,
  listRankedPublicListingCandidates,
  resolveCanonicalPublicArea,
  paginateRankedPublicListings,
  listPublicMarketFacets,
  listPublicListingsByAgent,
  listSimilarPublicListings,
  updateListing,
  updateListingRetentionPreference
} from "@/modules/listings/listing.repository";
import { getAgentProfile } from "@/modules/agents/agent.repository";
import { getEffectiveActiveListingLimit, getEffectivePlanSlug } from "@/lib/subscriptions";
import {
  createActiveListingLimitError,
  willConsumeNewActiveAvailableSlot
} from "@/lib/listing-limits";
import { createUnavailableLifecycle, hasListingMedia } from "@/lib/listing-retention";
import type { ListingRecord, SubscriptionRecord } from "@/lib/types";
import { normalizeAndVerifyListingImages } from "@/modules/listings/listing-image-payload";
import { isSubtypeForPropertyType } from "@/lib/property-taxonomy";

const getCachedPublicRankingSnapshot = unstable_cache(
  async (serializedFilters: string) =>
    listRankedPublicListingCandidates(
      JSON.parse(serializedFilters) as Parameters<typeof listRankedPublicListingCandidates>[0]
    ),
  ["public-listing-ranking-v2"],
  { tags: ["public-listings"], revalidate: 60 }
);

const getCachedMarketFacets = unstable_cache(
  async () => listPublicMarketFacets(),
  ["public-market-facets"],
  { tags: ["public-listings", "public-markets"], revalidate: 300 }
);

export async function getPublicListings(input: Record<string, unknown>) {
  const filters = listingFilterSchema.parse(input);
  const { page, limit, ...rankingFilters } = filters;
  const ranked = await getCachedPublicRankingSnapshot(JSON.stringify(rankingFilters));
  return paginateRankedPublicListings(ranked, page, limit);
}

export async function getPublicMarketFacets() {
  return getCachedMarketFacets();
}

export async function resolvePublicMarketArea(state: string, city: string, areaSlug: string) {
  return resolveCanonicalPublicArea(state, city, areaSlug);
}

export async function getPublicMarketPage(
  filters: {
    state?: string;
    city?: string;
    areaSlug?: string;
    propertyType?: string;
    propertySubtype?: string;
    listingCategory?: string;
    minPrice?: string | number;
    maxPrice?: string | number;
    bedrooms?: string | number;
    bathrooms?: string | number;
  },
  page = 1
) {
  const parsed = listingFilterSchema.parse({ ...filters, limit: 10, page });
  const marketFilters = {
    state: parsed.state,
    city: parsed.city,
    areaSlug: parsed.areaSlug,
    propertyType: parsed.propertyType,
    propertySubtype: parsed.propertySubtype,
    listingCategory: parsed.listingCategory,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    bedrooms: parsed.bedrooms,
    bathrooms: parsed.bathrooms
  };
  const ranked = await getCachedPublicRankingSnapshot(JSON.stringify(marketFilters));
  return buildPublicMarketPageFromRanked(ranked, Math.max(1, Math.trunc(page)), 10);
}

export async function getListingDetails(listingId: string) {
  return getListingById(listingId);
}

export async function getPublicListingDetails(listingId: string) {
  const listing = await getPublicListingByIdentifier(listingId);
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

export async function getPublicAgentListings(agentId: string, page = 1) {
  const [agent, listings] = await Promise.all([
    getPublicAgentSummary(agentId),
    listPublicListingsByAgent(agentId, page)
  ]);

  if (!agent) {
    return null;
  }

  return { agent, listings };
}

export async function getAgentListings(agentId: string, limit = 50) {
  return listAgentListings(agentId, limit);
}

export async function getAgentListingsPage(agentId: string, page = 1) {
  return listAgentListingsPage(agentId, page);
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

async function assertCanAddMediaBearingListing(
  agentId: string,
  planSlug: string,
  excludeListingId?: string
) {
  const { count, allowance } = await countMediaBearingListingsForAgent(agentId, planSlug, excludeListingId);
  if (count >= allowance) {
    throw new Error(
      `Your current plan can keep media for ${allowance} listings. Delete old inactive listings or upgrade before adding more property images.`
    );
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

  const payload = listingInputSchema.parse(normalizeAndVerifyListingImages(agentId, input));
  const initialStatus = agent.verificationStatus === "approved" ? "active" : "pending";
  const planSlug = getEffectivePlanSlug(subscription);

  await assertCanAddMediaBearingListing(agentId, planSlug);

  if (initialStatus === "active" && payload.availability === "available") {
    await assertCanAddActiveAvailableListing(agentId, getEffectiveActiveListingLimit(subscription));
  }

  const listing = await createListing(agentId, payload, initialStatus);
  if (payload.availability !== "available") {
    return updateListing(listing.id, createUnavailableLifecycle());
  }
  return listing;
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
  const payload = listingUpdateSchema.parse(normalizeAndVerifyListingImages(agentId, input));
  const nextPropertyType = payload.propertyType ?? currentListing.propertyType;
  const nextPropertySubtype = payload.propertySubtype === undefined
    ? currentListing.propertySubtype ?? null
    : payload.propertySubtype;
  if (nextPropertySubtype && !isSubtypeForPropertyType(nextPropertyType, nextPropertySubtype)) {
    throw new Error("Select a property subtype that matches the property group.");
  }
  const planSlug = getEffectivePlanSlug(subscription);

  const nextHasMedia =
    (payload.imageUrls !== undefined && payload.imageUrls.length > 0) ||
    (payload.imageVariants !== undefined && payload.imageVariants.length > 0) ||
    (payload.imageUrls === undefined && payload.imageVariants === undefined && hasListingMedia(currentListing));

  if (!hasListingMedia(currentListing) && nextHasMedia) {
    await assertCanAddMediaBearingListing(agentId, planSlug, listingId);
  }

  if (willConsumeNewActiveAvailableSlot(currentListing, payload)) {
    await assertCanAddActiveAvailableListing(
      agentId,
      getEffectiveActiveListingLimit(subscription),
      listingId
    );
  }

  const lifecycleUpdate: Partial<ListingRecord> = {};
  if (payload.availability && payload.availability !== "available" && currentListing.availability === "available") {
    Object.assign(lifecycleUpdate, createUnavailableLifecycle());
  }
  if (payload.availability === "available" && currentListing.availability !== "available" && currentListing.status === "active") {
    lifecycleUpdate.deactivatedAt = null;
    lifecycleUpdate.deactivationReason = null;
    lifecycleUpdate.retentionUntil = null;
    lifecycleUpdate.mediaDeleteAfter = null;
    lifecycleUpdate.hardDeleteAfter = null;
  }

  return updateListing(listingId, { ...payload, ...lifecycleUpdate });
}

export async function removeAgentListing(agentId: string, listingId: string) {
  await ensureAgentCanManageListings(agentId);
  await ensureAgentOwnsListing(agentId, listingId);
  return deleteListing(listingId);
}

export async function setAgentListingKeepActivePreference(
  agentId: string,
  listingId: string,
  keepActive: boolean
) {
  await ensureAgentCanManageListings(agentId);
  const listing = await ensureAgentOwnsListing(agentId, listingId);
  if (keepActive && (listing.status !== "active" || listing.availability !== "available" || listing.mediaDeletedAt)) {
    throw new Error("Only active available listings with images can be selected as preferred active listings.");
  }

  return updateListingRetentionPreference(listingId, keepActive ? Date.now() : null);
}

export async function reactivateAgentListing(agentId: string, listingId: string) {
  const { subscription } = await getAgentProfile(agentId);
  await ensureAgentCanManageListings(agentId);
  const listing = await ensureAgentOwnsListing(agentId, listingId);
  if (listing.status !== "inactive") {
    return listing;
  }
  if (listing.mediaDeletedAt || !hasListingMedia(listing)) {
    throw new Error("Images were already removed. Reupload property images before reactivating this listing.");
  }
  if (listing.availability === "available") {
    await assertCanAddActiveAvailableListing(agentId, getEffectiveActiveListingLimit(subscription), listingId);
  }

  return updateListing(listingId, {
    status: "active",
    deactivatedAt: null,
    deactivationReason: null,
    retentionUntil: null,
    mediaDeleteAfter: listing.availability === "available" ? null : listing.mediaDeleteAfter,
    hardDeleteAfter: listing.availability === "available" ? null : listing.hardDeleteAfter
  });
}
