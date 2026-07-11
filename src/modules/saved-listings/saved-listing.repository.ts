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

export async function listSavedListingReferences(userId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("saved_listings")
    .select("listing_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.listing_id as string);
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
