import { createServerSupabaseClient } from "@/lib/supabase/server";
import { splitListingsByActiveLimit } from "@/lib/listing-limits";
import { toNameCase } from "@/lib/format";
import { getListingCardFeatureBadges } from "@/lib/listing-quality";
import { rankListingsForFeed } from "@/lib/listing-visibility";
import { toListingRecord } from "@/lib/supabase-mappers";
import {
  ListingCategory,
  ListingFilters,
  ListingRecord,
  ListingStatus,
  PaginatedResponse,
  PropertyType,
  PublicListingCardRecord,
  PublicAgentSummary
} from "@/lib/types";

const PUBLIC_FEED_LISTINGS_SOURCE = "public_feed_listings";

type KeywordFilters = {
  state?: string;
  propertyType?: PropertyType;
  listingCategory?: ListingCategory;
  titleKeyword?: string;
};

type SimilarListingFilters = {
  state?: string;
  propertyType?: PropertyType;
  listingCategory?: ListingCategory;
};

function normalizeKeyword(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function createDescriptionPreview(value: string, maxLength = 110) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  return `${clipped || normalized.slice(0, maxLength).trim()}...`;
}

function parseKeywordFilters(keyword?: string): KeywordFilters {
  if (!keyword?.trim()) {
    return {};
  }

  let value = normalizeKeyword(keyword);
  const filters: KeywordFilters = {};

  if (/\blagos\b/.test(value)) {
    filters.state = "Lagos";
    value = value.replace(/\blagos\b/g, " ");
  }

  if (/\babuja\b/.test(value)) {
    filters.state = "Federal Capital Territory";
    value = value.replace(/\babuja\b/g, " ");
  }

  if (/\bshort\s*let\b/.test(value)) {
    filters.listingCategory = "short_let";
    value = value.replace(/\bshort\s*let\b/g, " ");
  } else if (/\bfor\s+rent\b|\brent\b/.test(value)) {
    filters.listingCategory = "for_rent";
    value = value.replace(/\bfor\s+rent\b|\brent\b/g, " ");
  } else if (/\bfor\s+sale\b|\bsale\b/.test(value)) {
    filters.listingCategory = "for_sale";
    value = value.replace(/\bfor\s+sale\b|\bsale\b/g, " ");
  }

  if (/\bflat\b|\bflats\b|\bmini\s+flat\b|\bmini\s+flats\b|\bself\s+contain\b|\bapartment\b/.test(value)) {
    filters.propertyType = "apartment";
    value = value.replace(/\bflat(s)?\b|\bmini\s+flat(s)?\b|\bself\s+contain\b|\bapartment(s)?\b/g, " ");
  } else if (/\bhouse\b|\bhouses\b|\bduplex\b|\bduplexes\b/.test(value)) {
    filters.propertyType = "duplex";
    value = value.replace(/\bhouse(s)?\b|\bduplex(es)?\b/g, " ");
  } else if (/\bland\b/.test(value)) {
    filters.propertyType = "land";
    value = value.replace(/\bland\b/g, " ");
  } else if (/\boffice\b|\boffices\b/.test(value)) {
    filters.propertyType = "office";
    value = value.replace(/\boffice(s)?\b/g, " ");
  } else if (/\bshop\b|\bshops\b/.test(value)) {
    filters.propertyType = "shop";
    value = value.replace(/\bshop(s)?\b/g, " ");
  }

  const titleKeyword = value.replace(/\bin\b/g, " ").replace(/\s+/g, " ").trim();
  if (titleKeyword.length >= 2) {
    filters.titleKeyword = titleKeyword;
  }

  return filters;
}

function toPublicListingCardRecord(
  listing: ListingRecord,
  agent?: PublicAgentSummary | null
): PublicListingCardRecord {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    propertyType: listing.propertyType,
    listingCategory: listing.listingCategory,
    availability: listing.availability,
    status: listing.status,
    imageUrls: listing.imageUrls,
    imageVariants: listing.imageVariants,
    promotionType: listing.promotionType,
    featuredUntil: listing.featuredUntil,
    sponsoredUntil: listing.sponsoredUntil,
    location: listing.location,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    toilets: listing.toilets,
    parkingSpaces: listing.parkingSpaces,
    propertySize: listing.propertySize,
    propertySizeUnit: listing.propertySizeUnit,
    landSize: listing.landSize,
    landSizeUnit: listing.landSizeUnit,
    descriptionPreview: createDescriptionPreview(listing.description),
    contactPhone: listing.contactPhone,
    contactWhatsapp: listing.contactWhatsapp,
    cardFeatureBadges: getListingCardFeatureBadges(listing),
    agentName: agent?.fullName ?? null,
    agentIsVerified: Boolean(agent?.isVerified)
  };
}

async function listPublicAgentSummaries(agentIds: string[]) {
  const uniqueAgentIds = Array.from(new Set(agentIds.filter(Boolean)));
  const summaries = new Map<string, PublicAgentSummary>();

  if (!uniqueAgentIds.length) {
    return summaries;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("agents")
    .select("id, verification_status, is_blocked, users!inner(full_name)")
    .in("id", uniqueAgentIds)
    .eq("verification_status", "approved")
    .eq("is_blocked", false);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    summaries.set(row.id, {
      id: row.id,
      fullName: toNameCase(user?.full_name ?? "Verified agent"),
      isVerified: row.verification_status === "approved"
    });
  }

  return summaries;
}

async function toPublicListingCardRecords(listings: ListingRecord[]) {
  const agentSummaries = await listPublicAgentSummaries(listings.map((listing) => listing.agentId));
  return listings.map((listing) => toPublicListingCardRecord(listing, agentSummaries.get(listing.agentId)));
}

export async function listPublicListings(
  filters: ListingFilters
): Promise<PaginatedResponse<PublicListingCardRecord>> {
  const supabase = createServerSupabaseClient();
  const keywordFilters = parseKeywordFilters(filters.keyword);
  const requestedLimit = filters.limit ?? 12;
  const candidateLimit = Math.min(Math.max(requestedLimit * 6, requestedLimit), 72);

  let query = supabase
    .from(PUBLIC_FEED_LISTINGS_SOURCE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(candidateLimit);

  const stateFilter = filters.state ?? keywordFilters.state;
  const propertyTypeFilter = filters.propertyType ?? keywordFilters.propertyType;
  const listingCategoryFilter = filters.listingCategory ?? keywordFilters.listingCategory;

  if (stateFilter) {
    query = query.eq("location->>state", stateFilter);
  }
  if (filters.city) {
    query = query.eq("location->>city", filters.city);
  }
  if (!stateFilter && !filters.city && filters.location) {
    query = query.eq("location->>slug", filters.location);
  }
  if (propertyTypeFilter) {
    query = query.eq("property_type", propertyTypeFilter);
  }
  if (listingCategoryFilter) {
    query = query.eq("listing_category", listingCategoryFilter);
  }
  if (keywordFilters.titleKeyword) {
    query = query.ilike("title", `%${keywordFilters.titleKeyword}%`);
  }
  if (filters.minPrice) {
    query = query.gte("price", filters.minPrice);
  }
  if (filters.maxPrice) {
    query = query.lte("price", filters.maxPrice);
  }
  if (filters.bedrooms) {
    query = query.gte("bedrooms", filters.bedrooms);
  }
  if (filters.bathrooms) {
    query = query.gte("bathrooms", filters.bathrooms);
  }
  if (filters.cursor) {
    const { data: cursorRow } = await supabase
      .from(PUBLIC_FEED_LISTINGS_SOURCE)
      .select("created_at")
      .eq("id", filters.cursor)
      .single();
    if (cursorRow?.created_at) {
      query = query.lt("created_at", cursorRow.created_at);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const candidates = (data ?? []).map(toListingRecord);
  const rankedListings = rankListingsForFeed(candidates, requestedLimit);
  const items = await toPublicListingCardRecords(rankedListings);
  const nextCursorIndex = Math.min(requestedLimit, candidates.length) - 1;
  const nextCursor = candidates.length > requestedLimit ? candidates[nextCursorIndex]?.id ?? null : null;
  return { items, nextCursor };
}

async function listSimilarPublicListingCandidates(
  listing: ListingRecord,
  filters: SimilarListingFilters,
  candidateLimit: number
) {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from(PUBLIC_FEED_LISTINGS_SOURCE)
    .select("*")
    .neq("id", listing.id)
    .order("created_at", { ascending: false })
    .limit(candidateLimit);

  if (filters.state) {
    query = query.eq("location->>state", filters.state);
  }
  if (filters.propertyType) {
    query = query.eq("property_type", filters.propertyType);
  }
  if (filters.listingCategory) {
    query = query.eq("listing_category", filters.listingCategory);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const candidates = (data ?? []).map(toListingRecord);
  return toPublicListingCardRecords(rankListingsForFeed(candidates, candidateLimit));
}

export async function listSimilarPublicListings(listing: ListingRecord, limit = 3) {
  if (limit <= 0) {
    return [];
  }

  const results: PublicListingCardRecord[] = [];
  const seenIds = new Set([listing.id]);
  const strategies: SimilarListingFilters[] = [
    {
      state: listing.location.state,
      propertyType: listing.propertyType,
      listingCategory: listing.listingCategory
    },
    {
      state: listing.location.state,
      listingCategory: listing.listingCategory
    },
    {
      propertyType: listing.propertyType,
      listingCategory: listing.listingCategory
    }
  ];

  for (const strategy of strategies) {
    const candidateLimit = Math.max((limit - results.length) * 4, 6);
    const matches = await listSimilarPublicListingCandidates(listing, strategy, candidateLimit);

    for (const match of matches) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        results.push(match);
      }
      if (results.length >= limit) {
        return results;
      }
    }
  }

  return results;
}

async function getListingRowById(listingId: string, source: "listings" | "public_listings") {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from(source).select("*").eq("id", listingId).single();
  if (error || !data) {
    return null;
  }
  return toListingRecord(data);
}

export async function getListingById(listingId: string) {
  return getListingRowById(listingId, "listings");
}

export async function getPublicListingById(listingId: string) {
  return getListingRowById(listingId, "public_listings");
}

export async function listPublicListingsByAgent(agentId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("public_listings")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return toPublicListingCardRecords((data ?? []).map(toListingRecord));
}

export async function listPublicListingCardsByIds(listingIds: string[]) {
  const uniqueListingIds = Array.from(new Set(listingIds.filter(Boolean)));
  if (!uniqueListingIds.length) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("public_listings").select("*").in("id", uniqueListingIds);

  if (error) {
    throw new Error(error.message);
  }

  const cards = await toPublicListingCardRecords((data ?? []).map(toListingRecord));
  const byId = new Map(cards.map((listing) => [listing.id, listing]));
  return uniqueListingIds.map((listingId) => byId.get(listingId)).filter((listing): listing is PublicListingCardRecord => Boolean(listing));
}

export async function getPublicAgentSummary(agentId: string): Promise<PublicAgentSummary | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("agents")
    .select("id, verification_status, is_blocked, users!inner(full_name)")
    .eq("id", agentId)
    .eq("verification_status", "approved")
    .eq("is_blocked", false)
    .single();

  if (error || !data) {
    return null;
  }

  const user = Array.isArray(data.users) ? data.users[0] : data.users;

  return {
    id: data.id,
    fullName: toNameCase(user?.full_name ?? "Verified agent"),
    isVerified: data.verification_status === "approved"
  };
}

export async function listAgentListings(agentId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map(toListingRecord);
}

export async function listListingsForAdmin() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map(toListingRecord);
}

export async function listListingsByAgentIds(agentIds: string[]) {
  if (!agentIds.length) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .in("agent_id", agentIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toListingRecord);
}

export async function listListingCountsByAgentIds(agentIds: string[]) {
  if (!agentIds.length) {
    return new Map<string, number>();
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("listings").select("agent_id").in("agent_id", agentIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((counts, row) => {
    const current = counts.get(row.agent_id) ?? 0;
    counts.set(row.agent_id, current + 1);
    return counts;
  }, new Map<string, number>());
}

export async function countActiveAvailableListingsForAgent(agentId: string, excludeListingId?: string) {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("status", "active")
    .eq("availability", "available");

  if (excludeListingId) {
    query = query.neq("id", excludeListingId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export type PendingListingActivationSummary = {
  activatedListings: number;
  keptPendingListings: number;
  activeListingLimit: number;
};

export type ActiveListingLimitEnforcementSummary = {
  demotedListings: number;
  activeListingLimit: number;
};

export async function activatePendingListingsForAgent(
  agentId: string,
  activeListingLimit: number
): Promise<PendingListingActivationSummary> {
  const supabase = createServerSupabaseClient();
  const [activeAvailableListings, pendingResult] = await Promise.all([
    countActiveAvailableListingsForAgent(agentId),
    supabase
      .from("listings")
      .select("*")
      .eq("agent_id", agentId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1000)
  ]);

  if (pendingResult.error) {
    throw new Error(pendingResult.error.message);
  }

  const pendingListings = (pendingResult.data ?? []).map(toListingRecord);
  const availableSlots = Math.max(activeListingLimit - activeAvailableListings, 0);
  const pendingUnavailableIds = pendingListings
    .filter((listing) => listing.availability !== "available")
    .map((listing) => listing.id);
  const pendingAvailableIds = pendingListings
    .filter((listing) => listing.availability === "available")
    .slice(0, availableSlots)
    .map((listing) => listing.id);
  const activateIds = [...pendingUnavailableIds, ...pendingAvailableIds];

  if (activateIds.length) {
    const { error } = await supabase
      .from("listings")
      .update({ status: "active" })
      .in("id", activateIds);

    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    activatedListings: activateIds.length,
    keptPendingListings: pendingListings.length - activateIds.length,
    activeListingLimit
  };
}

export async function demoteExcessActiveAvailableListingsForAgent(
  agentId: string,
  activeListingLimit: number
): Promise<ActiveListingLimitEnforcementSummary> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("agent_id", agentId)
    .eq("status", "active")
    .eq("availability", "available")
    .limit(2000);

  if (error) {
    throw new Error(error.message);
  }

  const activeListings = (data ?? []).map(toListingRecord);
  const { overflow } = splitListingsByActiveLimit(activeListings, activeListingLimit);
  const overflowIds = overflow.map((listing) => listing.id);

  if (overflowIds.length) {
    const { error: updateError } = await supabase
    .from("listings")
      .update({ status: "pending" })
      .in("id", overflowIds);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return {
    demotedListings: overflowIds.length,
    activeListingLimit
  };
}

export async function createListing(
  agentId: string,
  payload: Omit<ListingRecord, "id" | "status" | "createdAt" | "updatedAt" | "agentId">,
  initialStatus: Extract<ListingStatus, "active" | "pending">
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .insert({
      agent_id: agentId,
      title: payload.title,
      description: payload.description,
      price: payload.price,
      property_type: payload.propertyType,
      listing_category: payload.listingCategory,
      availability: payload.availability,
      status: initialStatus,
      image_urls: payload.imageUrls,
      image_variants: payload.imageVariants,
      contact_phone: payload.contactPhone,
      contact_whatsapp: payload.contactWhatsapp,
      location: payload.location,
      bedrooms: payload.bedrooms,
      bathrooms: payload.bathrooms,
      toilets: payload.toilets,
      parking_spaces: payload.parkingSpaces,
      property_size: payload.propertySize,
      property_size_unit: payload.propertySizeUnit,
      year_built: payload.yearBuilt,
      floor_level: payload.floorLevel,
      total_floors: payload.totalFloors,
      furnishing_status: payload.furnishingStatus,
      servicing_status: payload.servicingStatus,
      property_condition: payload.propertyCondition,
      amenities: payload.amenities,
      utilities: payload.utilities,
      safety_features: payload.safetyFeatures,
      nearby_landmarks: payload.nearbyLandmarks,
      extra_features: payload.extraFeatures,
      land_size: payload.landSize,
      land_size_unit: payload.landSizeUnit,
      title_document_type: payload.titleDocumentType,
      zoning_type: payload.zoningType,
      road_access: payload.roadAccess
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create listing.");
  }

  return toListingRecord(data);
}

export async function updateListing(
  listingId: string,
  payload: Partial<Omit<ListingRecord, "id" | "agentId" | "createdAt">>
) {
  const supabase = createServerSupabaseClient();
  const updates: Record<string, unknown> = {};

  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.price !== undefined) updates.price = payload.price;
  if (payload.propertyType !== undefined) updates.property_type = payload.propertyType;
  if (payload.listingCategory !== undefined) updates.listing_category = payload.listingCategory;
  if (payload.availability !== undefined) updates.availability = payload.availability;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.promotionType !== undefined) updates.promotion_type = payload.promotionType;
  if (payload.boostedAt !== undefined) updates.boosted_at = payload.boostedAt;
  if (payload.lastRefreshedAt !== undefined) updates.last_refreshed_at = payload.lastRefreshedAt;
  if (payload.expiresAt !== undefined) updates.expires_at = payload.expiresAt;
  if (payload.featuredUntil !== undefined) updates.featured_until = payload.featuredUntil;
  if (payload.sponsoredUntil !== undefined) updates.sponsored_until = payload.sponsoredUntil;
  if (payload.photosVerifiedAt !== undefined) updates.photos_verified_at = payload.photosVerifiedAt;
  if (payload.imageUrls !== undefined) updates.image_urls = payload.imageUrls;
  if (payload.imageVariants !== undefined) updates.image_variants = payload.imageVariants;
  if (payload.contactPhone !== undefined) updates.contact_phone = payload.contactPhone;
  if (payload.contactWhatsapp !== undefined) updates.contact_whatsapp = payload.contactWhatsapp;
  if (payload.location !== undefined) updates.location = payload.location;
  if (payload.bedrooms !== undefined) updates.bedrooms = payload.bedrooms;
  if (payload.bathrooms !== undefined) updates.bathrooms = payload.bathrooms;
  if (payload.toilets !== undefined) updates.toilets = payload.toilets;
  if (payload.parkingSpaces !== undefined) updates.parking_spaces = payload.parkingSpaces;
  if (payload.propertySize !== undefined) updates.property_size = payload.propertySize;
  if (payload.propertySizeUnit !== undefined) updates.property_size_unit = payload.propertySizeUnit;
  if (payload.yearBuilt !== undefined) updates.year_built = payload.yearBuilt;
  if (payload.floorLevel !== undefined) updates.floor_level = payload.floorLevel;
  if (payload.totalFloors !== undefined) updates.total_floors = payload.totalFloors;
  if (payload.furnishingStatus !== undefined) updates.furnishing_status = payload.furnishingStatus;
  if (payload.servicingStatus !== undefined) updates.servicing_status = payload.servicingStatus;
  if (payload.propertyCondition !== undefined) updates.property_condition = payload.propertyCondition;
  if (payload.amenities !== undefined) updates.amenities = payload.amenities;
  if (payload.utilities !== undefined) updates.utilities = payload.utilities;
  if (payload.safetyFeatures !== undefined) updates.safety_features = payload.safetyFeatures;
  if (payload.nearbyLandmarks !== undefined) updates.nearby_landmarks = payload.nearbyLandmarks;
  if (payload.extraFeatures !== undefined) updates.extra_features = payload.extraFeatures;
  if (payload.landSize !== undefined) updates.land_size = payload.landSize;
  if (payload.landSizeUnit !== undefined) updates.land_size_unit = payload.landSizeUnit;
  if (payload.titleDocumentType !== undefined) updates.title_document_type = payload.titleDocumentType;
  if (payload.zoningType !== undefined) updates.zoning_type = payload.zoningType;
  if (payload.roadAccess !== undefined) updates.road_access = payload.roadAccess;

  const { data, error } = await supabase
    .from("listings")
    .update(updates)
    .eq("id", listingId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update listing.");
  }

  return toListingRecord(data);
}

export async function deleteListing(listingId: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("listings").delete().eq("id", listingId);
  if (error) {
    throw new Error(error.message);
  }
}
