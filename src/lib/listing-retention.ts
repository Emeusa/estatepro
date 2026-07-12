import { getActiveListingLimit } from "@/lib/pricing";
import type { ListingRecord } from "@/lib/types";

export const OVERFLOW_MEDIA_RETENTION_DAYS = 45;
export const OVERFLOW_HARD_DELETE_DAYS = 90;
export const UNAVAILABLE_PUBLIC_GRACE_DAYS = 14;
export const UNAVAILABLE_MEDIA_RETENTION_DAYS = 60;
export const UNAVAILABLE_HARD_DELETE_DAYS = 120;
export const ADMIN_LEGAL_HOLD_DAYS = 180;

export type ListingDeactivationReason =
  | "plan_limit"
  | "subscription_expired"
  | "unavailable_archived"
  | "agent_reactivated"
  | "admin";

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function isoAddDays(date: Date, days: number) {
  return addDays(date, days).toISOString();
}

export function isFutureDate(value?: string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

export function hasListingMedia(listing: Pick<ListingRecord, "imageUrls" | "imageVariants" | "mediaDeletedAt">) {
  return !listing.mediaDeletedAt && (listing.imageUrls.length > 0 || listing.imageVariants.length > 0);
}

export function getMediaBearingListingAllowance(planSlug?: string | null) {
  const activeLimit = getActiveListingLimit(planSlug);
  if (planSlug === "free_starter" || !planSlug) {
    return Math.max(10, activeLimit * 3);
  }
  return activeLimit * 2;
}

export function createPlanLimitLifecycle(now = new Date()) {
  return {
    status: "inactive" as const,
    deactivatedAt: now.toISOString(),
    deactivationReason: "plan_limit",
    retentionUntil: now.toISOString(),
    mediaDeleteAfter: isoAddDays(now, OVERFLOW_MEDIA_RETENTION_DAYS),
    hardDeleteAfter: isoAddDays(now, OVERFLOW_HARD_DELETE_DAYS)
  };
}

export function createUnavailableLifecycle(now = new Date()) {
  return {
    retentionUntil: isoAddDays(now, UNAVAILABLE_PUBLIC_GRACE_DAYS),
    mediaDeleteAfter: isoAddDays(now, UNAVAILABLE_MEDIA_RETENTION_DAYS),
    hardDeleteAfter: isoAddDays(now, UNAVAILABLE_HARD_DELETE_DAYS)
  };
}

export function retentionSummary(listing: ListingRecord) {
  if (isFutureDate(listing.legalHoldUntil)) {
    return "Admin hold: this listing is protected from automatic deletion.";
  }
  if (listing.mediaDeletedAt) {
    return "Images were removed. Reupload photos before reactivating this listing.";
  }
  if (listing.status === "inactive" && listing.mediaDeleteAfter) {
    return `Inactive. Images are scheduled for deletion on ${new Date(listing.mediaDeleteAfter).toLocaleDateString("en-NG")}.`;
  }
  if (listing.availability !== "available" && listing.mediaDeleteAfter) {
    return `Unavailable. Images are scheduled for deletion on ${new Date(listing.mediaDeleteAfter).toLocaleDateString("en-NG")}.`;
  }
  return null;
}
