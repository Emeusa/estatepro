import { revalidatePath, revalidateTag } from "next/cache";

import type { ListingRecord } from "@/lib/types";

type ListingCacheTarget = Pick<ListingRecord, "id" | "slug" | "agentId">;

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    console.warn("[listings] cache revalidation failed", {
      path,
      message: error instanceof Error ? error.message : "Unknown revalidation error"
    });
  }
}

export function revalidateListingMutationPaths(listing?: ListingCacheTarget | null) {
  try {
    revalidateTag("public-listings");
    revalidateTag("public-markets");
  } catch (error) {
    console.warn("[listings] cache tag revalidation failed", {
      message: error instanceof Error ? error.message : "Unknown revalidation error"
    });
  }
  safeRevalidatePath("/");
  safeRevalidatePath("/properties");
  safeRevalidatePath("/sitemap.xml");

  if (!listing) {
    return;
  }

  safeRevalidatePath(`/agents/${listing.agentId}/listings`);
  safeRevalidatePath(`/listings/${listing.slug}`);
  safeRevalidatePath(`/listings/${listing.id}`);
}
