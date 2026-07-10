import { describe, expect, it } from "vitest";

import {
  isActiveAvailableListingState,
  splitListingsByActiveLimit,
  willConsumeNewActiveAvailableSlot
} from "../../src/lib/listing-limits";
import type { ListingRecord } from "../../src/lib/types";

const baseVisibility = {
  status: "active" as const,
  availability: "available" as const
};

function listing(id: string, createdAt: string, lastRefreshedAt?: string | null) {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    boostedAt: null,
    lastRefreshedAt: lastRefreshedAt ?? null
  } as Pick<ListingRecord, "id" | "createdAt" | "updatedAt" | "boostedAt" | "lastRefreshedAt">;
}

describe("listing active slot limits", () => {
  it("counts only active available listings as plan-visible inventory", () => {
    expect(isActiveAvailableListingState("active", "available")).toBe(true);
    expect(isActiveAvailableListingState("active", "sold")).toBe(false);
    expect(isActiveAvailableListingState("pending", "available")).toBe(false);
  });

  it("detects edits that would consume a new active available slot", () => {
    expect(
      willConsumeNewActiveAvailableSlot(
        { status: "active", availability: "sold" },
        { availability: "available" }
      )
    ).toBe(true);

    expect(
      willConsumeNewActiveAvailableSlot(
        { status: "pending", availability: "available" },
        { status: "active" }
      )
    ).toBe(true);

    expect(willConsumeNewActiveAvailableSlot(baseVisibility, {})).toBe(false);
  });

  it("keeps the most recently refreshed listings inside the active plan limit", () => {
    const { kept, overflow } = splitListingsByActiveLimit(
      [
        listing("old", "2026-01-01T00:00:00.000Z"),
        listing("new", "2026-01-03T00:00:00.000Z"),
        listing("refreshed", "2026-01-02T00:00:00.000Z", "2026-01-05T00:00:00.000Z")
      ],
      2
    );

    expect(kept.map((item) => item.id)).toEqual(["refreshed", "new"]);
    expect(overflow.map((item) => item.id)).toEqual(["old"]);
  });
});
