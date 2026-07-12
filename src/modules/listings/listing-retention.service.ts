import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toListingRecord } from "@/lib/supabase-mappers";
import type { ListingRecord } from "@/lib/types";
import { createUnavailableLifecycle, hasListingMedia, isFutureDate } from "@/lib/listing-retention";
import { sendListingRetentionEmail } from "@/modules/email/email.service";

type ListingRow = Parameters<typeof toListingRecord>[0];

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function storagePathFromPublicUrl(value: string) {
  try {
    const pathname = new URL(value).pathname;
    const marker = "/storage/v1/object/public/listing-images/";
    const index = pathname.indexOf(marker);
    if (index === -1) {
      return null;
    }
    return decodeURIComponent(pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

function listingStoragePaths(listing: ListingRecord) {
  const paths = new Set<string>();
  for (const url of listing.imageUrls) {
    const path = storagePathFromPublicUrl(url);
    if (path) {
      paths.add(path);
    }
  }
  for (const variant of listing.imageVariants) {
    for (const url of [variant.heroUrl, variant.cardUrl]) {
      const path = storagePathFromPublicUrl(url);
      if (path) {
        paths.add(path);
      }
    }
  }
  return Array.from(paths);
}

async function hasOpenReport(listingId: string) {
  const supabase = createServerSupabaseClient();
  const { count, error } = await supabase
    .from("listing_reports")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .in("status", ["open", "reviewing", "reviewed"]);

  if (error) {
    throw new Error(error.message);
  }
  return Boolean(count && count > 0);
}

async function isHeld(listing: ListingRecord) {
  return isFutureDate(listing.legalHoldUntil) || (await hasOpenReport(listing.id));
}

async function sendWarningEmails(listings: ListingRecord[]) {
  let remindersSent = 0;
  for (const listing of listings) {
    if (await isHeld(listing)) {
      continue;
    }

    if (listing.mediaDeleteAfter && !listing.mediaDeletedAt) {
      const remaining = daysUntil(listing.mediaDeleteAfter);
      const threshold = remaining <= 3 ? 3 : remaining <= 14 ? 14 : null;
      if (remaining > 0 && threshold) {
        await sendListingRetentionEmail({
          type: "media_delete_warning",
          listing,
          eventKey: `media_delete_warning:${listing.id}:${threshold}:${listing.mediaDeleteAfter.slice(0, 10)}`,
          subject: `Listing images may be deleted in ${remaining} day${remaining === 1 ? "" : "s"}`,
          heading: "Listing images scheduled for cleanup",
          body: [
            `"${listing.title}" is inactive or unavailable.`,
            `Images are scheduled for deletion on ${new Date(listing.mediaDeleteAfter).toLocaleDateString("en-NG")}. Reactivate the listing or renew your plan before then if you still need the media.`
          ]
        });
        remindersSent += 1;
      }
    }

    if (listing.hardDeleteAfter) {
      const remaining = daysUntil(listing.hardDeleteAfter);
      if (remaining > 0 && remaining <= 7) {
        await sendListingRetentionEmail({
          type: "hard_delete_warning",
          listing,
          eventKey: `hard_delete_warning:${listing.id}:7:${listing.hardDeleteAfter.slice(0, 10)}`,
          subject: "Listing scheduled for permanent deletion",
          heading: "Listing deletion notice",
          body: [
            `"${listing.title}" is scheduled for permanent deletion on ${new Date(listing.hardDeleteAfter).toLocaleDateString("en-NG")}.`,
            "If this property should remain on C59 Estatehub, update it before the deletion date."
          ]
        });
        remindersSent += 1;
      }
    }
  }
  return remindersSent;
}

export async function runListingRetentionMaintenance() {
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();
  let archivedUnavailable = 0;
  let scheduledUnavailable = 0;
  let mediaDeleted = 0;
  let hardDeleted = 0;
  let remindersSent = 0;

  const { data: legacyUnavailableRows, error: legacyUnavailableError } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "active")
    .neq("availability", "available")
    .is("retention_until", null)
    .limit(500);

  if (legacyUnavailableError) {
    throw new Error(legacyUnavailableError.message);
  }

  for (const listing of (legacyUnavailableRows ?? []).map((row) => toListingRecord(row as ListingRow))) {
    if (await isHeld(listing)) {
      continue;
    }
    const lifecycle = createUnavailableLifecycle();
    const { error } = await supabase
      .from("listings")
      .update({
        retention_until: lifecycle.retentionUntil,
        media_delete_after: lifecycle.mediaDeleteAfter,
        hard_delete_after: lifecycle.hardDeleteAfter
      })
      .eq("id", listing.id);
    if (error) {
      throw new Error(error.message);
    }
    scheduledUnavailable += 1;
  }

  const { data: warningRows, error: warningError } = await supabase
    .from("listings")
    .select("*")
    .or(`media_delete_after.lte.${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()},hard_delete_after.lte.${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}`)
    .limit(500);
  if (warningError) {
    throw new Error(warningError.message);
  }
  remindersSent += await sendWarningEmails((warningRows ?? []).map((row) => toListingRecord(row as ListingRow)));

  const { data: archiveRows, error: archiveError } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "active")
    .neq("availability", "available")
    .lte("retention_until", now)
    .limit(500);

  if (archiveError) {
    throw new Error(archiveError.message);
  }

  for (const listing of (archiveRows ?? []).map((row) => toListingRecord(row as ListingRow))) {
    if (await isHeld(listing)) {
      continue;
    }
    const { error } = await supabase
      .from("listings")
      .update({
        status: "inactive",
        deactivated_at: listing.deactivatedAt ?? now,
        deactivation_reason: "unavailable_archived"
      })
      .eq("id", listing.id);
    if (error) {
      throw new Error(error.message);
    }
    archivedUnavailable += 1;
    await sendListingRetentionEmail({
      type: "listing_deactivated",
      listing,
      eventKey: `listing_deactivated:${listing.id}:unavailable:${now.slice(0, 10)}`,
      subject: "Unavailable listing moved inactive",
      heading: "Your unavailable listing is now dashboard-only",
      body: [
        `"${listing.title}" was marked ${listing.availability} and is no longer shown publicly.`,
        "Its images will be kept temporarily. Update or reactivate the listing before the cleanup date if the property becomes available again."
      ]
    });
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from("listings")
    .select("*")
    .is("media_deleted_at", null)
    .lte("media_delete_after", now)
    .limit(500);

  if (mediaError) {
    throw new Error(mediaError.message);
  }

  for (const listing of (mediaRows ?? []).map((row) => toListingRecord(row as ListingRow))) {
    if (!hasListingMedia(listing) || (await isHeld(listing))) {
      continue;
    }
    const paths = listingStoragePaths(listing);
    if (paths.length) {
      const { error } = await supabase.storage.from("listing-images").remove(paths);
      if (error) {
        throw new Error(error.message);
      }
    }
    const { error } = await supabase
      .from("listings")
      .update({
        status: "inactive",
        image_urls: [],
        image_variants: [],
        media_deleted_at: now
      })
      .eq("id", listing.id);
    if (error) {
      throw new Error(error.message);
    }
    mediaDeleted += 1;
    await sendListingRetentionEmail({
      type: "media_deleted",
      listing,
      eventKey: `media_deleted:${listing.id}:${now.slice(0, 10)}`,
      subject: "Listing images were removed",
      heading: "Listing images removed after retention window",
      body: [
        `Images for "${listing.title}" were removed after the retention period ended.`,
        "The listing record remains temporarily for audit/recovery, but you must reupload images before it can be made public again."
      ]
    });
  }

  const { data: deleteRows, error: deleteError } = await supabase
    .from("listings")
    .select("*")
    .lte("hard_delete_after", now)
    .limit(500);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  for (const listing of (deleteRows ?? []).map((row) => toListingRecord(row as ListingRow))) {
    if (await isHeld(listing)) {
      continue;
    }
    const paths = listingStoragePaths(listing);
    if (paths.length) {
      const { error } = await supabase.storage.from("listing-images").remove(paths);
      if (error) {
        throw new Error(error.message);
      }
    }
    await sendListingRetentionEmail({
      type: "listing_deleted",
      listing,
      eventKey: `listing_deleted:${listing.id}`,
      subject: "Listing was permanently deleted",
      heading: "Listing deleted after retention window",
      body: [
        `"${listing.title}" was permanently deleted after the retention period ended.`,
        "You can create a new listing if the property becomes available again."
      ]
    });
    const { error } = await supabase.from("listings").delete().eq("id", listing.id);
    if (error) {
      throw new Error(error.message);
    }
    hardDeleted += 1;
  }

  return { scheduledUnavailable, archivedUnavailable, mediaDeleted, hardDeleted, remindersSent };
}
