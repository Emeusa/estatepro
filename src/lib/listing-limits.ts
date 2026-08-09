import type { ListingAvailability, ListingRecord, ListingStatus } from "@/lib/types";

type ListingVisibilityUpdate = Partial<Pick<ListingRecord, "status" | "availability">>;

type ListingActivityInput = Pick<
  ListingRecord,
  "id" | "createdAt" | "updatedAt" | "boostedAt" | "lastRefreshedAt" | "agentKeepActivePriority"
>;

type ListingReactivationInput = ListingActivityInput &
  Pick<
    ListingRecord,
    | "status"
    | "availability"
    | "deactivationReason"
    | "mediaDeletedAt"
    | "imageUrls"
    | "imageVariants"
    | "expiresAt"
  >;

export class ActiveListingLimitError extends Error {
  status = 403;
}

export function createActiveListingLimitError(activeListingLimit: number) {
  return new ActiveListingLimitError(
    `Your current plan allows ${activeListingLimit} active available listings. Upgrade your plan to post more properties.`
  );
}

export function isActiveAvailableListingState(
  status: ListingStatus,
  availability: ListingAvailability
) {
  return status === "active" && availability === "available";
}

export function willConsumeNewActiveAvailableSlot(
  current: Pick<ListingRecord, "status" | "availability">,
  update: ListingVisibilityUpdate
) {
  const currentCounts = isActiveAvailableListingState(current.status, current.availability);
  const nextCounts = isActiveAvailableListingState(
    update.status ?? current.status,
    update.availability ?? current.availability
  );

  return !currentCounts && nextCounts;
}

function latestActivityMs(listing: ListingActivityInput) {
  return Math.max(
    ...[listing.lastRefreshedAt, listing.boostedAt, listing.updatedAt, listing.createdAt]
      .filter(Boolean)
      .map((value) => new Date(value as string).getTime())
  );
}

export function splitListingsByActiveLimit<T extends ListingActivityInput>(
  listings: T[],
  activeListingLimit: number
) {
  const sorted = [...listings].sort((first, second) => {
    const priorityDiff = (second.agentKeepActivePriority ?? 0) - (first.agentKeepActivePriority ?? 0);
    if (priorityDiff) {
      return priorityDiff;
    }
    const timeDiff = latestActivityMs(second) - latestActivityMs(first);
    return timeDiff || first.id.localeCompare(second.id);
  });

  return {
    kept: sorted.slice(0, Math.max(activeListingLimit, 0)),
    overflow: sorted.slice(Math.max(activeListingLimit, 0))
  };
}

export function isEligibleForAutomaticPlanReactivation(listing: ListingReactivationInput, now = new Date()) {
  const hasMedia = !listing.mediaDeletedAt && (listing.imageUrls.length > 0 || listing.imageVariants.length > 0);
  const hasNotExpired = !listing.expiresAt || new Date(listing.expiresAt).getTime() > now.getTime();

  return (
    listing.status === "inactive" &&
    listing.availability === "available" &&
    (listing.deactivationReason === "plan_limit" || listing.deactivationReason === "subscription_expired") &&
    hasMedia &&
    hasNotExpired
  );
}

export function selectListingsForAutomaticPlanReactivation<T extends ListingReactivationInput>(
  listings: T[],
  availableSlots: number,
  now = new Date()
) {
  return splitListingsByActiveLimit(
    listings.filter((listing) => isEligibleForAutomaticPlanReactivation(listing, now)),
    availableSlots
  ).kept;
}
