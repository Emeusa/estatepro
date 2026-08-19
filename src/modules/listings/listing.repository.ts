import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAgentDisplayName, normalizeBusinessName } from "@/lib/agent-display";
import {
  buildListingSlugBase,
  getAvailableListingSlug,
  isUuidListingIdentifier
} from "@/lib/listing-slugs";
import { selectListingsForAutomaticPlanReactivation, splitListingsByActiveLimit } from "@/lib/listing-limits";
import { createPlanLimitLifecycle, getMediaBearingListingAllowance } from "@/lib/listing-retention";
import { toNameCase } from "@/lib/format";
import { getListingImageCount } from "@/lib/listing-images";
import { getListingCardFeatureBadges } from "@/lib/listing-quality";
import { rankListingsForFeed, rankListingsForFeedWithDiagnostics } from "@/lib/listing-visibility";
import { getNigeriaStateStorageValues, normalizeNigeriaState } from "@/lib/nigeria-locations";
import {
  getLegacySubtypeForPropertyType,
  getPropertyTypeStorageValues,
  isPropertySubtype,
  normalizePropertyType
} from "@/lib/property-taxonomy";
import { slugifyLocation } from "@/lib/sanitize";
import { toListingRecord } from "@/lib/supabase-mappers";
import {
  ListingCategory,
  ListingFilters,
  ListingRecord,
  ListingStatus,
  PaginatedResponse,
  PropertySubtype,
  PropertyType,
  PublicMarketFacet,
  PublicMarketPage,
  PublicListingCardRecord,
  PublicAgentSummary
} from "@/lib/types";

const PUBLIC_FEED_LISTINGS_SOURCE = "public_feed_listings";
const PUBLIC_CARD_IMAGE_LIMIT = 4;
const PUBLIC_PAGE_SIZE = 10;
const PUBLIC_RANKING_BATCH_SIZE = 500;
const PUBLIC_RANKING_COLUMNS = [
  "id",
  "agent_id",
  "title",
  "description",
  "price",
  "property_type",
  "property_subtype",
  "area_slug",
  "listing_category",
  "availability",
  "status",
  "image_urls",
  "image_variants",
  "promotion_type",
  "boosted_at",
  "last_refreshed_at",
  "expires_at",
  "featured_until",
  "sponsored_until",
  "photos_verified_at",
  "location",
  "bedrooms",
  "bathrooms",
  "property_size",
  "land_size",
  "amenities",
  "utilities",
  "safety_features",
  "title_document_type",
  "created_at",
  "updated_at"
].join(",");
const PUBLIC_RANKING_COLUMNS_LEGACY = PUBLIC_RANKING_COLUMNS
  .split(",")
  .filter((column) => column !== "property_subtype" && column !== "area_slug")
  .join(",");

type KeywordFilters = {
  state?: string;
  propertyType?: PropertyType;
  propertySubtype?: PropertySubtype;
  listingCategory?: ListingCategory;
  titleKeyword?: string;
};

type SimilarListingFilters = {
  state?: string;
  propertyType?: PropertyType;
  listingCategory?: ListingCategory;
};

export type ListingSitemapEntry = {
  slug: string;
  updatedAt: string;
};

type SeoAreaRow = {
  state: string;
  city: string;
  canonical_name: string;
  slug: string;
  aliases: string[] | null;
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

function isMissingSlugColumnError(error: { message?: string; code?: string } | null | undefined) {
  return error?.code === "42703" || /column .*slug.* does not exist/i.test(error?.message ?? "");
}

function isMissingTaxonomyColumnError(error: { message?: string; code?: string } | null | undefined) {
  return /property_subtype|area_slug/i.test(error?.message ?? "") &&
    (error?.code === "42703" || error?.code === "PGRST204" || /does not exist|schema cache/i.test(error?.message ?? ""));
}

function isDuplicateSlugError(error: { message?: string; code?: string } | null | undefined) {
  return error?.code === "23505" && /slug/i.test(error?.message ?? "");
}

function isMissingSeoAreasTable(error: { message?: string; code?: string } | null | undefined) {
  return error?.code === "42P01" || /seo_areas/i.test(error?.message ?? "");
}

async function listSeoAreas(state: string, city: string): Promise<SeoAreaRow[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("seo_areas")
    .select("state, city, canonical_name, slug, aliases")
    .eq("state", state)
    .eq("city", city)
    .limit(250);

  if (error) {
    if (isMissingSeoAreasTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as SeoAreaRow[];
}

async function listAllSeoAreas(): Promise<SeoAreaRow[]> {
  const supabase = createServerSupabaseClient();
  const rows: SeoAreaRow[] = [];
  const batchSize = 1000;
  for (let from = 0; from < 5000; from += batchSize) {
    const { data, error } = await supabase
      .from("seo_areas")
      .select("state, city, canonical_name, slug, aliases")
      .order("state", { ascending: true })
      .order("city", { ascending: true })
      .order("slug", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) {
      if (isMissingSeoAreasTable(error)) return [];
      throw new Error(error.message);
    }
    const batch = (data ?? []) as SeoAreaRow[];
    rows.push(...batch);
    if (batch.length < batchSize) break;
  }
  return rows;
}

export async function resolveCanonicalPublicArea(state: string, city: string, areaSlug: string) {
  const normalized = slugifyLocation([areaSlug]);
  const row = (await listSeoAreas(state, city)).find((item) =>
    item.slug === normalized || (item.aliases ?? []).some((alias) => slugifyLocation([alias]) === normalized)
  );
  if (row) return { name: row.canonical_name, slug: row.slug, city: row.city };
  const stateMatches = (await listAllSeoAreas()).filter((item) =>
    item.state === state &&
    (item.slug === normalized || (item.aliases ?? []).some((alias) => slugifyLocation([alias]) === normalized))
  );
  return stateMatches.length === 1
    ? { name: stateMatches[0].canonical_name, slug: stateMatches[0].slug, city: stateMatches[0].city }
    : null;
}

async function normalizeListingAreaSlug(location: ListingRecord["location"]) {
  const requestedSlug = location.areaSlug ?? slugifyLocation([location.area]);
  const canonical = await resolveCanonicalPublicArea(location.state, location.city, requestedSlug);
  if (canonical) return { ...location, city: canonical.city, areaSlug: canonical.slug };
  return { ...location, areaSlug: requestedSlug };
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

  if (/\bflat\b|\bflats\b|\bmini\s+flat\b|\bmini\s+flats\b|\bself[ -]?contain\b|\bapartment\b|\bstudio\b/.test(value)) {
    filters.propertyType = "apartment";
    if (/\bmini\s+flat/.test(value)) filters.propertySubtype = "mini_flat";
    else if (/\bself[ -]?contain/.test(value)) filters.propertySubtype = "self_contain";
    else if (/\bstudio/.test(value)) filters.propertySubtype = "studio_apartment";
    value = value.replace(/\bflat(s)?\b|\bmini\s+flat(s)?\b|\bself\s+contain\b|\bapartment(s)?\b/g, " ");
  } else if (/\bhouse\b|\bhouses\b|\bduplex\b|\bduplexes\b|\bbungalow\b|\btownhouse\b|\bmansion\b|\bvilla\b/.test(value)) {
    filters.propertyType = "house";
    if (/\bsemi[ -]?detached\s+duplex/.test(value)) filters.propertySubtype = "semi_detached_duplex";
    else if (/\bdetached\s+duplex/.test(value)) filters.propertySubtype = "detached_duplex";
    else if (/\bterrace(d)?\s+duplex/.test(value)) filters.propertySubtype = "terraced_duplex";
    else if (/\bduplex/.test(value)) filters.propertySubtype = "duplex";
    else if (/\bbungalow/.test(value)) filters.propertySubtype = "bungalow";
    value = value.replace(/\bhouse(s)?\b|\bduplex(es)?\b|\bbungalow(s)?\b|\btownhouse(s)?\b|\bmansion(s)?\b|\bvilla(s)?\b/g, " ");
  } else if (/\bsingle\s+room\b|\broom\s+and\s+parlour\b|\bboys'?\s+quarters\b|\bshared\s+room\b/.test(value)) {
    filters.propertyType = "room";
    if (/\broom\s+and\s+parlour/.test(value)) filters.propertySubtype = "room_and_parlour";
    else if (/\bboys'?\s+quarters/.test(value)) filters.propertySubtype = "boys_quarters";
    else if (/\bshared\s+room/.test(value)) filters.propertySubtype = "shared_room";
    else filters.propertySubtype = "single_room";
    value = value.replace(/\bsingle\s+room\b|\broom\s+and\s+parlour\b|\bboys'?\s+quarters\b|\bshared\s+room\b/g, " ");
  } else if (/\bland\b/.test(value)) {
    filters.propertyType = "land";
    if (/\bresidential\s+land/.test(value)) filters.propertySubtype = "residential_land";
    else if (/\bcommercial\s+land/.test(value)) filters.propertySubtype = "commercial_land";
    else if (/\bindustrial\s+land/.test(value)) filters.propertySubtype = "industrial_land";
    else if (/\bfarm\s+land|\bagricultural\s+land/.test(value)) filters.propertySubtype = "agricultural_land";
    value = value.replace(/\bland\b/g, " ");
  } else if (/\boffice\b|\boffices\b|\bwarehouse\b|\bfactory\b|\bhotel\b|\bshop\b|\bshops\b/.test(value)) {
    filters.propertyType = "commercial";
    if (/\bwarehouse/.test(value)) filters.propertySubtype = "warehouse";
    else if (/\bfactory/.test(value)) filters.propertySubtype = "factory";
    else if (/\bhotel/.test(value)) filters.propertySubtype = "hotel";
    else if (/\bshop/.test(value)) filters.propertySubtype = "shop";
    else filters.propertySubtype = "office";
    value = value.replace(/\boffice(s)?\b|\bwarehouse(s)?\b|\bfactor(y|ies)\b|\bhotel(s)?\b|\bshop(s)?\b/g, " ");
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
    slug: listing.slug,
    title: listing.title,
    price: listing.price,
    propertyType: listing.propertyType,
    propertySubtype: listing.propertySubtype ?? null,
    listingCategory: listing.listingCategory,
    availability: listing.availability,
    status: listing.status,
    updatedAt: listing.updatedAt,
    imageCount: getListingImageCount(listing),
    imageUrls: listing.imageUrls.slice(0, PUBLIC_CARD_IMAGE_LIMIT),
    imageVariants: [...listing.imageVariants]
      .sort((first, second) => first.order - second.order)
      .slice(0, PUBLIC_CARD_IMAGE_LIMIT),
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
    agentName: agent?.displayName ?? null,
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
    .select("*, users!inner(full_name)")
    .in("id", uniqueAgentIds)
    .eq("verification_status", "approved")
    .eq("is_blocked", false);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const fullName = toNameCase(user?.full_name ?? "Verified agent");
    const businessName = normalizeBusinessName(row.business_name);
    summaries.set(row.id, {
      id: row.id,
      fullName,
      businessName,
      displayName: getAgentDisplayName(fullName, businessName),
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
  const rankedListings = await listRankedPublicListingCandidates(filters);
  return paginateRankedPublicListings(rankedListings, filters.page, filters.limit);
}

export async function paginateRankedPublicListings(
  rankedListings: ListingRecord[],
  page = 1,
  limit = PUBLIC_PAGE_SIZE
): Promise<PaginatedResponse<PublicListingCardRecord>> {
  const safePage = Math.max(1, Math.trunc(page));
  const pageSize = Math.min(PUBLIC_PAGE_SIZE, Math.max(1, Math.trunc(limit)));
  const start = (safePage - 1) * pageSize;
  const selectedIds = rankedListings.slice(start, start + pageSize).map((listing) => listing.id);
  const items = await listPublicListingCardsByIds(selectedIds);

  return {
    items,
    pagination: {
      currentPage: safePage,
      pageSize,
      totalItems: rankedListings.length,
      totalPages: Math.max(1, Math.ceil(rankedListings.length / pageSize))
    }
  };
}

async function listPublicListingCandidates(filters: ListingFilters) {
  const supabase = createServerSupabaseClient();
  const keywordFilters = parseKeywordFilters(filters.keyword);
  const stateFilter = filters.state ?? keywordFilters.state;
  const propertyTypeFilter = filters.propertyType ?? keywordFilters.propertyType;
  const propertySubtypeFilter = filters.propertySubtype ?? keywordFilters.propertySubtype;
  const listingCategoryFilter = filters.listingCategory ?? keywordFilters.listingCategory;
  const candidates: ListingRecord[] = [];

  for (let from = 0; ; from += PUBLIC_RANKING_BATCH_SIZE) {
    function createQuery(columns: string, includeTaxonomy: boolean) {
      let query = supabase
        .from(PUBLIC_FEED_LISTINGS_SOURCE)
        .select(columns)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PUBLIC_RANKING_BATCH_SIZE - 1);

      if (stateFilter) {
        const stateValues = getNigeriaStateStorageValues(stateFilter);
        query = stateValues.length === 1
          ? query.eq("location->>state", stateValues[0])
          : query.in("location->>state", stateValues);
      }
      if (filters.city) query = query.eq("location->>city", filters.city);
      if (includeTaxonomy && filters.areaSlug) query = query.eq("area_slug", filters.areaSlug);
      if (!stateFilter && !filters.city && filters.location) query = query.eq("location->>slug", filters.location);
      if (propertyTypeFilter) query = query.in("property_type", getPropertyTypeStorageValues(propertyTypeFilter));
      if (includeTaxonomy && propertySubtypeFilter) query = query.eq("property_subtype", propertySubtypeFilter);
      if (listingCategoryFilter) query = query.eq("listing_category", listingCategoryFilter);
      if (keywordFilters.titleKeyword) query = query.ilike("title", `%${keywordFilters.titleKeyword}%`);
      if (filters.minPrice) query = query.gte("price", filters.minPrice);
      if (filters.maxPrice) query = query.lte("price", filters.maxPrice);
      if (filters.bedrooms) query = query.gte("bedrooms", filters.bedrooms);
      if (filters.bathrooms) query = query.gte("bathrooms", filters.bathrooms);
      return query;
    }

    let { data, error } = await createQuery(PUBLIC_RANKING_COLUMNS, true);
    if (isMissingTaxonomyColumnError(error)) {
      const legacyResult = await createQuery(PUBLIC_RANKING_COLUMNS_LEGACY, false);
      data = legacyResult.data;
      error = legacyResult.error;
    }
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const mappedRows = rows.map((row) =>
        toListingRecord({
          ...(row as unknown as Record<string, unknown>),
          contact_phone: "",
          contact_whatsapp: ""
        } as Parameters<typeof toListingRecord>[0])
      );
    candidates.push(...mappedRows.filter((listing) => {
      if (filters.areaSlug && (listing.location.areaSlug ?? slugifyLocation([listing.location.area])) !== filters.areaSlug) {
        return false;
      }
      if (propertySubtypeFilter && listing.propertySubtype !== propertySubtypeFilter) return false;
      return true;
    }));
    if (rows.length < PUBLIC_RANKING_BATCH_SIZE) break;
  }

  return candidates;
}

export async function listRankedPublicListingCandidates(filters: ListingFilters) {
  return rankListingsForFeed(await listPublicListingCandidates(filters));
}

export async function listRankedPublicListingCandidatesWithDiagnostics(filters: ListingFilters) {
  return rankListingsForFeedWithDiagnostics(await listPublicListingCandidates(filters));
}

type PublicMarketFilters = Pick<
  ListingFilters,
  "state" | "city" | "areaSlug" | "propertyType" | "propertySubtype" | "listingCategory" | "minPrice" | "maxPrice" | "bedrooms" | "bathrooms"
>;

function getDuplicateListingRatio(listings: ListingRecord[]) {
  if (!listings.length) return 0;
  const fingerprints = new Map<string, number>();
  for (const listing of listings) {
    const fingerprint = [listing.title, listing.location.area, listing.location.city, listing.price]
      .map((value) => normalizeKeyword(String(value)))
      .join("|");
    fingerprints.set(fingerprint, (fingerprints.get(fingerprint) ?? 0) + 1);
  }
  return Math.max(...fingerprints.values()) / listings.length;
}

export async function listPublicMarketPage(
  filters: PublicMarketFilters,
  page = 1,
  pageSize = PUBLIC_PAGE_SIZE
): Promise<PublicMarketPage> {
  const ranked = await listRankedPublicListingCandidates(filters);
  return buildPublicMarketPageFromRanked(ranked, page, pageSize);
}

export async function buildPublicMarketPageFromRanked(
  ranked: ListingRecord[],
  page = 1,
  pageSize = PUBLIC_PAGE_SIZE
): Promise<PublicMarketPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(PUBLIC_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)));
  const start = (safePage - 1) * safePageSize;
  const selected = ranked.slice(start, start + safePageSize);
  const listingCount = ranked.length;
  const cityCounts = new Map<string, number>();
  const typeCounts = new Map<PropertyType, number>();
  const areaCounts = new Map<string, { name: string; count: number }>();
  const subtypeCounts = new Map<PropertySubtype, number>();

  for (const listing of ranked) {
    cityCounts.set(listing.location.city, (cityCounts.get(listing.location.city) ?? 0) + 1);
    typeCounts.set(listing.propertyType, (typeCounts.get(listing.propertyType) ?? 0) + 1);
    const areaSlug = listing.location.areaSlug ?? slugifyLocation([listing.location.area]);
    const currentArea = areaCounts.get(areaSlug);
    areaCounts.set(areaSlug, { name: listing.location.area, count: (currentArea?.count ?? 0) + 1 });
    if (listing.propertySubtype) {
      subtypeCounts.set(listing.propertySubtype, (subtypeCounts.get(listing.propertySubtype) ?? 0) + 1);
    }
  }

  return {
    items: await listPublicListingCardsByIds(selected.map((listing) => listing.id)),
    listingCount,
    latestUpdatedAt: ranked
      .map((listing) => listing.updatedAt)
      .sort((first, second) => second.localeCompare(first))[0] ?? null,
    duplicateRatio: getDuplicateListingRatio(ranked),
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(listingCount / safePageSize)),
    activeCities: [...cityCounts.entries()]
      .map(([name, cityCount]) => ({ name, count: cityCount }))
      .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name)),
    activePropertyTypes: [...typeCounts.entries()]
      .map(([propertyType, typeCount]) => ({ propertyType, count: typeCount }))
      .sort((first, second) => second.count - first.count),
    activeAreas: [...areaCounts.entries()]
      .map(([slug, value]) => ({ slug, name: value.name, count: value.count }))
      .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name)),
    activePropertySubtypes: [...subtypeCounts.entries()]
      .map(([propertySubtype, count]) => ({ propertySubtype, count }))
      .sort((first, second) => second.count - first.count)
  };
}

export async function listPublicMarketFacets(): Promise<PublicMarketFacet[]> {
  const supabase = createServerSupabaseClient();
  const seoAreasPromise = listAllSeoAreas();
  const listingRows: Array<Record<string, unknown>> = [];
  const batchSize = 1000;
  let includeTaxonomy = true;
  for (let from = 0; from < 45000;) {
    const columns = includeTaxonomy
      ? "id, location, area_slug, listing_category, property_type, property_subtype, title, price, updated_at"
      : "id, location, listing_category, property_type, title, price, updated_at";
    const { data, error } = await supabase
      .from(PUBLIC_FEED_LISTINGS_SOURCE)
      .select(columns)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error && includeTaxonomy && isMissingTaxonomyColumnError(error)) {
      includeTaxonomy = false;
      listingRows.length = 0;
      from = 0;
      continue;
    }
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Array<Record<string, unknown>>;
    listingRows.push(...batch);
    if (batch.length < batchSize) break;
    from += batchSize;
  }
  const seoAreas = await seoAreasPromise;

  const canonicalAreas = new Map<string, SeoAreaRow | null>();
  for (const row of seoAreas) {
    for (const value of [row.slug, ...(row.aliases ?? []).map((alias) => slugifyLocation([alias]))]) {
      const key = `${row.state}|${value}`;
      const existing = canonicalAreas.get(key);
      if (!canonicalAreas.has(key)) canonicalAreas.set(key, row);
      else if (existing?.city !== row.city || existing.slug !== row.slug) canonicalAreas.set(key, null);
    }
  }

  const facets = new Map<string, PublicMarketFacet>();
  for (const row of listingRows) {
    const location = row.location as { state?: string; city?: string; area?: string; areaSlug?: string } | null;
    if (!location?.state || !location.city) continue;
    const listingCategory = row.listing_category as ListingCategory;
    const storedPropertyType = typeof row.property_type === "string" ? row.property_type : null;
    const propertyType = normalizePropertyType(storedPropertyType);
    const propertySubtype = typeof row.property_subtype === "string" && isPropertySubtype(row.property_subtype)
      ? row.property_subtype
      : getLegacySubtypeForPropertyType(storedPropertyType);
    const state = normalizeNigeriaState(location.state);
    const rawArea = location.area?.trim() ?? "";
    const rawAreaSlug = String(row.area_slug ?? location.areaSlug ?? slugifyLocation([rawArea]));
    const canonicalArea = canonicalAreas.get(`${state}|${rawAreaSlug}`);
    const area = canonicalArea?.canonical_name ?? rawArea;
    const areaSlug = canonicalArea?.slug ?? rawAreaSlug;
    const city = canonicalArea?.city ?? location.city;
    const fingerprint = [row.title, area, city, row.price]
      .map((value) => normalizeKeyword(String(value ?? "")))
      .join("|");
    const key = [state, city, areaSlug, listingCategory, propertyType, propertySubtype ?? ""].join("|");
    const current = facets.get(key);
    facets.set(key, {
      state,
      city,
      area,
      areaSlug,
      listingCategory,
      propertyType,
      propertySubtype,
      listingCount: (current?.listingCount ?? 0) + 1,
      listingFingerprints: [...(current?.listingFingerprints ?? []), fingerprint],
      latestUpdatedAt:
        !current || String(row.updated_at).localeCompare(current.latestUpdatedAt) > 0
          ? String(row.updated_at)
          : current.latestUpdatedAt
    });
  }

  return [...facets.values()];
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
    const stateValues = getNigeriaStateStorageValues(filters.state);
    query = stateValues.length === 1
      ? query.eq("location->>state", stateValues[0])
      : query.in("location->>state", stateValues);
  }
  if (filters.propertyType) {
    query = query.in("property_type", getPropertyTypeStorageValues(filters.propertyType));
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

async function getListingRowBySlug(slug: string, source: "listings" | "public_listings") {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from(source).select("*").eq("slug", slug).single();
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

export async function getPublicListingByIdentifier(identifier: string) {
  if (isUuidListingIdentifier(identifier)) {
    return getPublicListingById(identifier);
  }

  return getListingRowBySlug(identifier, "public_listings");
}

export async function listPublicListingsByAgent(
  agentId: string,
  page = 1,
  pageSize = PUBLIC_PAGE_SIZE
): Promise<PaginatedResponse<PublicListingCardRecord>> {
  const supabase = createServerSupabaseClient();
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(PUBLIC_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)));
  const from = (safePage - 1) * safePageSize;
  const { data, error, count } = await supabase
    .from("public_listings")
    .select("*", { count: "exact" })
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + safePageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  const totalItems = count ?? 0;
  return {
    items: await toPublicListingCardRecords((data ?? []).map(toListingRecord)),
    pagination: {
      currentPage: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / safePageSize))
    }
  };
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

export async function listPublicListingSitemapEntries(limit = 1000): Promise<ListingSitemapEntry[]> {
  const supabase = createServerSupabaseClient();
  const safeLimit = Math.min(45000, Math.max(1, Math.trunc(limit)));
  const rows: Array<{ id: string; slug: string | null; updated_at: string }> = [];
  const batchSize = 1000;
  for (let from = 0; from < safeLimit; from += batchSize) {
    const to = Math.min(from + batchSize, safeLimit) - 1;
    const { data, error } = await supabase
      .from(PUBLIC_FEED_LISTINGS_SOURCE)
      .select("id, slug, updated_at")
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      if (isMissingSlugColumnError(error)) return [];
      throw new Error(error.message);
    }
    const batch = (data ?? []) as Array<{ id: string; slug: string | null; updated_at: string }>;
    rows.push(...batch);
    if (batch.length < to - from + 1) break;
  }

  return rows
    .map((row) => ({
      slug: typeof row.slug === "string" && row.slug ? row.slug : row.id,
      updatedAt: row.updated_at
    }))
    .filter((row) => Boolean(row.slug));
}

export async function getPublicAgentSummary(agentId: string): Promise<PublicAgentSummary | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*, users!inner(full_name)")
    .eq("id", agentId)
    .eq("verification_status", "approved")
    .eq("is_blocked", false)
    .single();

  if (error || !data) {
    return null;
  }

  const user = Array.isArray(data.users) ? data.users[0] : data.users;
  const fullName = toNameCase(user?.full_name ?? "Verified agent");
  const businessName = normalizeBusinessName(data.business_name);

  return {
    id: data.id,
    fullName,
    businessName,
    displayName: getAgentDisplayName(fullName, businessName),
    isVerified: data.verification_status === "approved"
  };
}

export async function listAgentListings(agentId: string, limit = 50) {
  if (limit <= 0) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.trunc(limit), 50));
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map(toListingRecord);
}

export async function listAgentListingsPage(agentId: string, page = 1, pageSize = PUBLIC_PAGE_SIZE) {
  const supabase = createServerSupabaseClient();
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(PUBLIC_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)));
  const from = (safePage - 1) * safePageSize;
  const { data, error, count } = await supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + safePageSize - 1);
  if (error) throw new Error(error.message);
  const totalItems = count ?? 0;
  return {
    items: (data ?? []).map(toListingRecord),
    pagination: {
      currentPage: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / safePageSize))
    }
  };
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

export async function countMediaBearingListingsForAgent(
  agentId: string,
  planSlug: string,
  excludeListingId?: string
) {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("listings")
    .select("id, image_urls, image_variants, media_deleted_at")
    .eq("agent_id", agentId)
    .is("media_deleted_at", null)
    .limit(5000);

  if (excludeListingId) {
    query = query.neq("id", excludeListingId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const count = (data ?? []).filter((listing) => {
    const imageUrls = Array.isArray(listing.image_urls) ? listing.image_urls : [];
    const imageVariants = Array.isArray(listing.image_variants) ? listing.image_variants : [];
    return imageUrls.length > 0 || imageVariants.length > 0;
  }).length;

  return {
    count,
    allowance: getMediaBearingListingAllowance(planSlug)
  };
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

export async function reactivateEligiblePlanLimitedListingsForAgent(
  agentId: string,
  activeListingLimit: number
) {
  const supabase = createServerSupabaseClient();
  const activeListingCount = await countActiveAvailableListingsForAgent(agentId);
  const availableSlots = Math.max(activeListingLimit - activeListingCount, 0);
  if (!availableSlots) {
    return 0;
  }

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("agent_id", agentId)
    .eq("status", "inactive")
    .eq("availability", "available")
    .in("deactivation_reason", ["plan_limit", "subscription_expired"])
    .is("media_deleted_at", null)
    .limit(2000);

  if (error) {
    throw new Error(error.message);
  }

  const reactivateIds = selectListingsForAutomaticPlanReactivation(
    (data ?? []).map(toListingRecord),
    availableSlots
  ).map((listing) => listing.id);

  if (!reactivateIds.length) {
    return 0;
  }

  const { data: updatedListings, error: updateError } = await supabase
    .from("listings")
    .update({
      status: "active",
      deactivated_at: null,
      deactivation_reason: null,
      retention_until: null,
      media_delete_after: null,
      hard_delete_after: null
    })
    .eq("agent_id", agentId)
    .eq("status", "inactive")
    .eq("availability", "available")
    .in("deactivation_reason", ["plan_limit", "subscription_expired"])
    .in("id", reactivateIds)
    .select("id");

  if (updateError) {
    throw new Error(updateError.message);
  }

  return updatedListings?.length ?? 0;
}

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
    const lifecycle = createPlanLimitLifecycle();
    const { error: updateError } = await supabase
      .from("listings")
      .update({
        status: lifecycle.status,
        deactivated_at: lifecycle.deactivatedAt,
        deactivation_reason: lifecycle.deactivationReason,
        retention_until: lifecycle.retentionUntil,
        media_delete_after: lifecycle.mediaDeleteAfter,
        hard_delete_after: lifecycle.hardDeleteAfter
      })
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

async function createUniqueListingSlug(
  payload: Omit<ListingRecord, "id" | "slug" | "status" | "createdAt" | "updatedAt" | "agentId">
) {
  const base = buildListingSlugBase({
    title: payload.title,
    listingCategory: payload.listingCategory,
    location: payload.location
  });
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("slug")
    .gte("slug", base)
    .lte("slug", `${base}\uffff`);

  if (error) {
    if (isMissingSlugColumnError(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  return getAvailableListingSlug(
    base,
    (data ?? [])
      .map((row) => row.slug)
      .filter((slug): slug is string => typeof slug === "string" && (slug === base || slug.startsWith(`${base}-`)))
  );
}

export async function createListing(
  agentId: string,
  payload: Omit<ListingRecord, "id" | "slug" | "status" | "createdAt" | "updatedAt" | "agentId">,
  initialStatus: Extract<ListingStatus, "active" | "pending">
) {
  const supabase = createServerSupabaseClient();
  const location = await normalizeListingAreaSlug(payload.location);
  let slug = await createUniqueListingSlug(payload);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const insertPayload: Record<string, unknown> = {
      agent_id: agentId,
      slug,
      title: payload.title,
      description: payload.description,
      price: payload.price,
      property_type: payload.propertyType,
      property_subtype: payload.propertySubtype ?? null,
      area_slug: location.areaSlug,
      listing_category: payload.listingCategory,
      availability: payload.availability,
      status: initialStatus,
      image_urls: payload.imageUrls,
      image_variants: payload.imageVariants,
      contact_phone: payload.contactPhone,
      contact_whatsapp: payload.contactWhatsapp,
      location,
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
    };

    if (!slug) {
      delete insertPayload.slug;
    }

    const { data, error } = await supabase
      .from("listings")
      .insert(insertPayload)
      .select("*")
      .single();

    if (!error && data) {
      return toListingRecord(data);
    }

    if (slug && isMissingSlugColumnError(error)) {
      slug = null;
      continue;
    }

    if (slug && isDuplicateSlugError(error)) {
      slug = await createUniqueListingSlug(payload);
      continue;
    }

    throw new Error(error?.message ?? "Could not create listing.");
  }

  throw new Error("Could not create a unique listing URL.");
}

export async function updateListing(
  listingId: string,
  payload: Partial<Omit<ListingRecord, "id" | "slug" | "agentId" | "createdAt">>
) {
  const supabase = createServerSupabaseClient();
  const updates: Record<string, unknown> = {};
  const location = payload.location ? await normalizeListingAreaSlug(payload.location) : null;

  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.price !== undefined) updates.price = payload.price;
  if (payload.propertyType !== undefined) updates.property_type = payload.propertyType;
  if (payload.propertySubtype !== undefined) updates.property_subtype = payload.propertySubtype;
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
  if (payload.deactivatedAt !== undefined) updates.deactivated_at = payload.deactivatedAt;
  if (payload.deactivationReason !== undefined) updates.deactivation_reason = payload.deactivationReason;
  if (payload.retentionUntil !== undefined) updates.retention_until = payload.retentionUntil;
  if (payload.mediaDeleteAfter !== undefined) updates.media_delete_after = payload.mediaDeleteAfter;
  if (payload.hardDeleteAfter !== undefined) updates.hard_delete_after = payload.hardDeleteAfter;
  if (payload.mediaDeletedAt !== undefined) updates.media_deleted_at = payload.mediaDeletedAt;
  if (payload.legalHoldUntil !== undefined) updates.legal_hold_until = payload.legalHoldUntil;
  if (payload.agentKeepActivePriority !== undefined) updates.agent_keep_active_priority = payload.agentKeepActivePriority;
  if (payload.imageUrls !== undefined) updates.image_urls = payload.imageUrls;
  if (payload.imageVariants !== undefined) updates.image_variants = payload.imageVariants;
  if (payload.contactPhone !== undefined) updates.contact_phone = payload.contactPhone;
  if (payload.contactWhatsapp !== undefined) updates.contact_whatsapp = payload.contactWhatsapp;
  if (location) {
    updates.location = location;
    updates.area_slug = location.areaSlug;
  }
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

export async function updateListingRetentionPreference(
  listingId: string,
  priority: number | null
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .update({ agent_keep_active_priority: priority })
    .eq("id", listingId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update listing preference.");
  }

  return toListingRecord(data);
}

export async function updateListingLegalHold(listingId: string, legalHoldUntil: string | null) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .update({ legal_hold_until: legalHoldUntil })
    .eq("id", listingId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update listing legal hold.");
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
