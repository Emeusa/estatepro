import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toNameCase } from "@/lib/format";
import { toListingRecord } from "@/lib/supabase-mappers";
import { ListingCategory, ListingFilters, ListingRecord, PaginatedResponse, PropertyType, PublicAgentSummary } from "@/lib/types";

const PUBLIC_FEED_LISTINGS_SOURCE = "public_feed_listings";

type KeywordFilters = {
  state?: string;
  propertyType?: PropertyType;
  listingCategory?: ListingCategory;
  titleKeyword?: string;
};

function normalizeKeyword(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
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

export async function listPublicListings(
  filters: ListingFilters
): Promise<PaginatedResponse<ListingRecord>> {
  const supabase = createServerSupabaseClient();
  const keywordFilters = parseKeywordFilters(filters.keyword);

  let query = supabase
    .from(PUBLIC_FEED_LISTINGS_SOURCE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 12);

  const stateFilter = filters.state ?? keywordFilters.state;
  const propertyTypeFilter = filters.propertyType ?? keywordFilters.propertyType;

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
  if (keywordFilters.listingCategory) {
    query = query.eq("listing_category", keywordFilters.listingCategory);
  }
  if (keywordFilters.titleKeyword) {
    query = query.ilike("title", `%${keywordFilters.titleKeyword}%`);
  }
  if (filters.maxPrice) {
    query = query.lte("price", filters.maxPrice);
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

  const items = (data ?? []).map(toListingRecord);
  const nextCursor = items.length === (filters.limit ?? 12) ? items.at(-1)?.id ?? null : null;
  return { items, nextCursor };
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

  return (data ?? []).map(toListingRecord);
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

export async function activatePendingListingsForAgent(agentId: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("listings")
    .update({ status: "active" })
    .eq("agent_id", agentId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }
}

export async function createListing(
  agentId: string,
  payload: Omit<ListingRecord, "id" | "status" | "createdAt" | "updatedAt" | "agentId">
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
      status: "pending",
      image_urls: payload.imageUrls,
      contact_phone: payload.contactPhone,
      contact_whatsapp: payload.contactWhatsapp,
      location: payload.location
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
  if (payload.imageUrls !== undefined) updates.image_urls = payload.imageUrls;
  if (payload.contactPhone !== undefined) updates.contact_phone = payload.contactPhone;
  if (payload.contactWhatsapp !== undefined) updates.contact_whatsapp = payload.contactWhatsapp;
  if (payload.location !== undefined) updates.location = payload.location;

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
