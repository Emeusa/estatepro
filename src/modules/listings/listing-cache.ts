import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";

import type { ListingRecord } from "@/lib/types";
import { getListingMarketPaths } from "@/modules/seo/seo-market-routes";

type ListingCacheTarget = Pick<
  ListingRecord,
  | "id"
  | "slug"
  | "agentId"
  | "location"
  | "listingCategory"
  | "propertyType"
  | "propertySubtype"
  | "updatedAt"
>;

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

export function revalidateListingMutationPaths(
  listing?: ListingCacheTarget | null,
  previousListing?: ListingCacheTarget | null
) {
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
  safeRevalidatePath("/properties/locations");
  safeRevalidatePath("/sitemap.xml");
  safeRevalidatePath("/sitemaps/listings.xml");
  safeRevalidatePath("/sitemaps/markets.xml");

  if (!listing) {
    try {
      after(async () => {
        try {
          const { refreshSeoMarketEligibility } = await import("@/modules/seo/seo-discovery.service");
          await refreshSeoMarketEligibility();
        } catch (error) {
          console.warn("[seo] deferred market refresh failed", {
            message: error instanceof Error ? error.message : "Unknown SEO refresh error"
          });
        }
      });
    } catch (error) {
      console.warn("[seo] could not schedule deferred market refresh", {
        message: error instanceof Error ? error.message : "Unknown SEO scheduling error"
      });
    }
    return;
  }

  const marketPaths = Array.from(new Set([
    ...getListingMarketPaths(listing),
    ...(previousListing ? getListingMarketPaths(previousListing) : [])
  ]));
  for (const path of marketPaths) safeRevalidatePath(path);
  safeRevalidatePath(`/agents/${listing.agentId}/listings`);
  safeRevalidatePath(`/listings/${listing.slug}`);
  safeRevalidatePath(`/listings/${listing.id}`);
  if (previousListing && previousListing.agentId !== listing.agentId) {
    safeRevalidatePath(`/agents/${previousListing.agentId}/listings`);
  }
  if (previousListing && previousListing.slug !== listing.slug) {
    safeRevalidatePath(`/listings/${previousListing.slug}`);
  }

  try {
    after(async () => {
      try {
        const { refreshSeoMarketEligibility } = await import("@/modules/seo/seo-discovery.service");
        await refreshSeoMarketEligibility(marketPaths);
      } catch (error) {
        console.warn("[seo] deferred market refresh failed", {
          listingId: listing.id,
          message: error instanceof Error ? error.message : "Unknown SEO refresh error"
        });
      }
    });
  } catch (error) {
    console.warn("[seo] could not schedule deferred market refresh", {
      listingId: listing.id,
      message: error instanceof Error ? error.message : "Unknown SEO scheduling error"
    });
  }
}
