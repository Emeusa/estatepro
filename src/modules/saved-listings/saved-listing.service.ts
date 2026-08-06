import { recordListingEvent } from "@/modules/analytics/analytics.service";
import { getPublicListingById, listPublicListingCardsByIds } from "@/modules/listings/listing.repository";
import {
  getSavedListingIds,
  listSavedListingReferences,
  removeSavedListingReference,
  saveListingReference
} from "@/modules/saved-listings/saved-listing.repository";

export async function listSavedListings(userId: string, page = 1) {
  const { listingIds, pagination } = await listSavedListingReferences(userId, page);
  return { items: await listPublicListingCardsByIds(listingIds), pagination };
}

export async function listSavedListingIds(userId: string, listingIds: string[]) {
  if (!listingIds.length) {
    return [];
  }

  return getSavedListingIds(userId, listingIds);
}

export async function saveListing(userId: string, listingId: string) {
  const listing = await getPublicListingById(listingId);
  if (!listing) {
    throw new Error("This listing is no longer available to save.");
  }

  await saveListingReference(userId, listingId);

  await recordListingEvent({
    listingId,
    eventType: "save"
  }).catch(() => undefined);
}

export async function removeSavedListing(userId: string, listingId: string) {
  await removeSavedListingReference(userId, listingId);
}
