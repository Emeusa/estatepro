import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getSavedListingIds(userId: string, listingIds?: string[]) {
  const supabase = createServerSupabaseClient();
  let query = supabase.from("saved_listings").select("listing_id").eq("user_id", userId);

  if (listingIds?.length) {
    query = query.in("listing_id", listingIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.listing_id as string);
}

export async function listSavedListingReferences(userId: string, page = 1, pageSize = 10) {
  const supabase = createServerSupabaseClient();
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(10, Math.max(1, Math.trunc(pageSize)));
  const from = (safePage - 1) * safePageSize;
  const { data, error, count } = await supabase
    .from("saved_listings")
    .select("listing_id", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("listing_id", { ascending: true })
    .range(from, from + safePageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  const totalItems = count ?? 0;
  return {
    listingIds: (data ?? []).map((row) => row.listing_id as string),
    pagination: {
      currentPage: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / safePageSize))
    }
  };
}

export async function saveListingReference(userId: string, listingId: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("saved_listings")
    .upsert({ user_id: userId, listing_id: listingId }, { onConflict: "user_id,listing_id", ignoreDuplicates: true });

  if (error) {
    throw new Error(error.message);
  }
}

export async function removeSavedListingReference(userId: string, listingId: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("saved_listings").delete().eq("user_id", userId).eq("listing_id", listingId);

  if (error) {
    throw new Error(error.message);
  }
}
