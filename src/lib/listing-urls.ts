import type { ListingRecord, PublicListingCardRecord } from "@/lib/types";

export function getListingHref(listing: Pick<ListingRecord | PublicListingCardRecord, "id" | "slug">) {
  return `/listings/${listing.slug || listing.id}`;
}
