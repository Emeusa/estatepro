import { describe, expect, it } from "vitest";

import {
  buildHomepageMetadata,
  getHomepageFilterValues,
  hasHomepageActiveFilters
} from "../../src/lib/homepage-filters";

describe("homepage filter defaults and SEO", () => {
  it("defaults the bare homepage to all listings", () => {
    expect(getHomepageFilterValues({})).toMatchObject({
      initialType: undefined,
      initialCategory: undefined
    });
    expect(hasHomepageActiveFilters({})).toBe(false);
  });

  it("keeps valid land filter URLs functional", () => {
    expect(getHomepageFilterValues({ propertyType: "land" })).toMatchObject({
      initialType: "land",
      initialCategory: undefined
    });
    expect(hasHomepageActiveFilters({ propertyType: "land" })).toBe(true);
  });

  it("ignores invalid category/type query values", () => {
    expect(getHomepageFilterValues({ propertyType: "villa", listingCategory: "lease" })).toMatchObject({
      initialType: undefined,
      initialCategory: undefined
    });
    expect(hasHomepageActiveFilters({ propertyType: "villa", listingCategory: "lease" })).toBe(false);
  });

  it("deindexes filtered homepage variants while keeping the bare homepage indexable", () => {
    expect(buildHomepageMetadata({}).robots).toBeUndefined();
    expect(buildHomepageMetadata({ propertyType: "land" }).robots).toEqual({
      index: false,
      follow: true
    });
    expect(buildHomepageMetadata({ propertyType: "land" }).alternates?.canonical).toBe("/");
  });
});
