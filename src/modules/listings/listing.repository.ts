import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toListingRecord } from "@/lib/supabase-mappers";
import { ListingFilters, ListingRecord, PaginatedResponse } from "@/lib/types";

async function listPublicAgentIds() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("agents")
    .select("id")
    .eq("verification_status", "approved")
    .eq("is_blocked", false)
    .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((agent) => agent.id as string);
}

export async function listPublicListings(
  filters: ListingFilters
): Promise<PaginatedResponse<ListingRecord>> {
  const supabase = createServerSupabaseClient();
  const publicAgentIds = await listPublicAgentIds();

  if (!publicAgentIds.length) {
    return { items: [], nextCursor: null };
  }

  let query = supabase
    .from("listings")
    .select("*")
    .eq("status", "active")
    .in("agent_id", publicAgentIds)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 12);

  if (filters.state) {
    query = query.eq("location->>state", filters.state);
  }
  if (filters.city) {
    query = query.eq("location->>city", filters.city);
  }
  if (!filters.state && !filters.city && filters.location) {
    query = query.eq("location->>slug", filters.location);
  }
  if (filters.propertyType) {
    query = query.eq("property_type", filters.propertyType);
  }
  if (filters.maxPrice) {
    query = query.lte("price", filters.maxPrice);
  }
  if (filters.cursor) {
    const { data: cursorRow } = await supabase
      .from("listings")
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

export async function getListingById(listingId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("listings").select("*").eq("id", listingId).single();
  if (error || !data) {
    return null;
  }
  return toListingRecord(data);
}

export async function listPublicListingsByAgent(agentId: string) {
  const publicAgentIds = await listPublicAgentIds();
  if (!publicAgentIds.includes(agentId)) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "active")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toListingRecord);
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
