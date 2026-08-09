import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isEligibleForAutomaticPlanReactivation,
  isActiveAvailableListingState,
  selectListingsForAutomaticPlanReactivation,
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

function inactivePlanListing(
  id: string,
  createdAt: string,
  overrides: Partial<ListingRecord> = {}
) {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    boostedAt: null,
    lastRefreshedAt: null,
    agentKeepActivePriority: null,
    status: "inactive",
    availability: "available",
    deactivationReason: "plan_limit",
    mediaDeletedAt: null,
    imageUrls: [`https://example.com/${id}.webp`],
    imageVariants: [],
    expiresAt: null,
    ...overrides
  } as ListingRecord;
}

describe("listing active slot limits", () => {
  it("does not rate-limit authenticated listing creation", () => {
    const routeSource = readFileSync(path.join(process.cwd(), "src/app/api/listings/route.ts"), "utf8");
    const rateLimitSource = readFileSync(path.join(process.cwd(), "src/lib/security/rate-limit.ts"), "utf8");

    expect(routeSource).not.toContain("getAgentDailyListingLimit");
    expect(routeSource).not.toContain("RATE_LIMITS.listingCreate");
    expect(routeSource).not.toContain("rateLimit(request");
    expect(rateLimitSource).not.toContain("listingCreate");
  });

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

  it("selects eligible plan-demoted listings by preference and recent activity", () => {
    const selected = selectListingsForAutomaticPlanReactivation(
      [
        inactivePlanListing("recent", "2026-08-03T00:00:00.000Z"),
        inactivePlanListing("preferred", "2026-08-01T00:00:00.000Z", { agentKeepActivePriority: 1 }),
        inactivePlanListing("older", "2026-08-02T00:00:00.000Z")
      ],
      2,
      new Date("2026-08-09T00:00:00.000Z")
    );

    expect(selected.map((item) => item.id)).toEqual(["preferred", "recent"]);
  });

  it("excludes unsafe or unrelated inactive listings from automatic reactivation", () => {
    const now = new Date("2026-08-09T00:00:00.000Z");
    expect(isEligibleForAutomaticPlanReactivation(inactivePlanListing("safe", now.toISOString()), now)).toBe(true);
    expect(
      isEligibleForAutomaticPlanReactivation(
        inactivePlanListing("unavailable", now.toISOString(), { availability: "sold" }),
        now
      )
    ).toBe(false);
    expect(
      isEligibleForAutomaticPlanReactivation(
        inactivePlanListing("admin", now.toISOString(), { deactivationReason: "admin" }),
        now
      )
    ).toBe(false);
    expect(
      isEligibleForAutomaticPlanReactivation(
        inactivePlanListing("deleted", now.toISOString(), { mediaDeletedAt: now.toISOString() }),
        now
      )
    ).toBe(false);
    expect(
      isEligibleForAutomaticPlanReactivation(
        inactivePlanListing("no-media", now.toISOString(), { imageUrls: [], imageVariants: [] }),
        now
      )
    ).toBe(false);
    expect(
      isEligibleForAutomaticPlanReactivation(
        inactivePlanListing("expired", now.toISOString(), { expiresAt: "2026-08-08T00:00:00.000Z" }),
        now
      )
    ).toBe(false);
  });
});
