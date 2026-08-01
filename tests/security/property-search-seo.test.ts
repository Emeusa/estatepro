import { describe, expect, it } from "vitest";

import { getLgasForState, NIGERIA_STATES } from "../../src/lib/nigeria-locations";
import {
  buildPropertyMarketPath,
  getLegacyPropertyRedirect,
  getMarketIndexability,
  getMarketTitle,
  parsePropertyMarketSegments,
  resolveStateSlug
} from "../../src/lib/property-search";

describe("nationwide property search routes", () => {
  it("builds and parses national, state, city, and property-type routes", () => {
    expect(parsePropertyMarketSegments([])).toMatchObject({ kind: "national", path: "/properties" });
    expect(parsePropertyMarketSegments(["for-rent"])).toMatchObject({
      kind: "national",
      category: "for_rent",
      path: "/properties/for-rent"
    });
    expect(parsePropertyMarketSegments(["lagos"])).toMatchObject({ kind: "state", state: "Lagos" });
    expect(getMarketTitle(parsePropertyMarketSegments(["lagos"])!)).toBe("Property listings in Lagos");
    expect(parsePropertyMarketSegments(["for-sale", "lagos", "ikeja", "apartments"])).toMatchObject({
      kind: "city_type",
      state: "Lagos",
      city: "Ikeja",
      category: "for_sale",
      propertyType: "apartment"
    });
  });

  it("uses Abuja publicly while retaining the FCT database value", () => {
    expect(resolveStateSlug("abuja")).toBe("Federal Capital Territory");
    expect(buildPropertyMarketPath({ state: "Federal Capital Territory" })).toBe("/properties/abuja");
    expect(
      buildPropertyMarketPath({
        category: "for_rent",
        state: "Federal Capital Territory",
        city: "Municipal"
      })
    ).toBe("/properties/for-rent/abuja/municipal");
  });

  it("canonicalizes Nasarawa without breaking the legacy dataset spelling", () => {
    expect(NIGERIA_STATES).toContain("Nasarawa");
    expect(NIGERIA_STATES).not.toContain("Nassarawa");
    expect(resolveStateSlug("nassarawa")).toBe("Nasarawa");
    expect(getLgasForState("Nasarawa").length).toBeGreaterThan(0);
  });

  it("redirects only simple valid legacy state/category filters", () => {
    expect(getLegacyPropertyRedirect({ state: "Lagos", listingCategory: "for_rent" })).toBe(
      "/properties/for-rent/lagos"
    );
    expect(getLegacyPropertyRedirect({ state: "Lagos", minPrice: "100000" })).toBeNull();
    expect(getLegacyPropertyRedirect({ state: "Not a state", listingCategory: "for_rent" })).toBeNull();
  });
});

describe("inventory-driven indexing", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");
  const recent = "2026-07-25T12:00:00.000Z";

  it("enforces the configured market thresholds", () => {
    const stateRoute = parsePropertyMarketSegments(["lagos"]);
    const cityRoute = parsePropertyMarketSegments(["for-rent", "lagos", "ikeja"]);
    const typeRoute = parsePropertyMarketSegments(["for-rent", "lagos", "ikeja", "apartments"]);

    expect(stateRoute && getMarketIndexability(stateRoute, { listingCount: 2, latestUpdatedAt: recent, duplicateRatio: 0 }, now).eligible).toBe(false);
    expect(stateRoute && getMarketIndexability(stateRoute, { listingCount: 3, latestUpdatedAt: recent, duplicateRatio: 0 }, now).eligible).toBe(true);
    expect(cityRoute && getMarketIndexability(cityRoute, { listingCount: 4, latestUpdatedAt: recent, duplicateRatio: 0 }, now).eligible).toBe(false);
    expect(typeRoute && getMarketIndexability(typeRoute, { listingCount: 8, latestUpdatedAt: recent, duplicateRatio: 0 }, now).eligible).toBe(true);
  });

  it("requires freshness and rejects severe duplicate concentration", () => {
    const route = parsePropertyMarketSegments(["for-rent", "lagos"]);
    expect(route).not.toBeNull();
    if (!route) return;

    expect(getMarketIndexability(route, { listingCount: 5, latestUpdatedAt: "2025-01-01T00:00:00.000Z", duplicateRatio: 0 }, now).eligible).toBe(false);
    expect(getMarketIndexability(route, { listingCount: 5, latestUpdatedAt: recent, duplicateRatio: 0.8 }, now).eligible).toBe(false);
  });
});
