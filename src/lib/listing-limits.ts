import type { ListingAvailability, ListingRecord, ListingStatus } from "@/lib/types";

type ListingVisibilityUpdate = Partial<Pick<ListingRecord, "status" | "availability">>;

type ListingActivityInput = Pick<
  ListingRecord,
  "id" | "createdAt" | "updatedAt" | "boostedAt" | "lastRefreshedAt"
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
    const timeDiff = latestActivityMs(second) - latestActivityMs(first);
    return timeDiff || first.id.localeCompare(second.id);
  });

  return {
    kept: sorted.slice(0, Math.max(activeListingLimit, 0)),
    overflow: sorted.slice(Math.max(activeListingLimit, 0))
  };
}
