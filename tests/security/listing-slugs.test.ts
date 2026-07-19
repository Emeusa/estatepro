import { describe, expect, it } from "vitest";

import {
  buildListingSlugBase,
  getAvailableListingSlug,
  isUuidListingIdentifier,
  slugifyListingText,
  withListingSlugSuffix
} from "../../src/lib/listing-slugs";
import { getListingHref } from "../../src/lib/listing-urls";

describe("listing slug helpers", () => {
  it("builds descriptive listing slugs from title, category, and location", () => {
    expect(
      buildListingSlugBase({
        title: "Self-Contain Apartment",
        listingCategory: "for_rent",
        location: {
          area: "Ikot Ekpene",
          city: "Ikot Ekpene",
          state: "Akwa Ibom"
        }
      })
    ).toBe("self-contain-apartment-for-rent-ikot-ekpene-akwa-ibom");
  });

  it("normalizes punctuation, accents, symbols, and duplicate spaces", () => {
    expect(slugifyListingText("  3 Bedroom!! Àpartment @ Lekki Phase 1  ")).toBe(
      "3-bedroom-apartment-lekki-phase-1"
    );
  });

  it("does not repeat listing category text already present in the title", () => {
    expect(
      buildListingSlugBase({
        title: "Luxury Duplex For Rent",
        listingCategory: "for_rent",
        location: {
          area: "Lekki Phase 1",
          city: "Eti Osa",
          state: "Lagos"
        }
      })
    ).toBe("luxury-duplex-for-rent-lekki-phase-1-eti-osa-lagos");
  });

  it("caps long slugs before adding suffixes", () => {
    const base = buildListingSlugBase({
      title: "Luxury ".repeat(30),
      listingCategory: "for_sale",
      location: {
        area: "Victoria Island",
        city: "Eti Osa",
        state: "Lagos"
      }
    });

    expect(base.length).toBeLessThanOrEqual(120);
    expect(withListingSlugSuffix(base, 23).length).toBeLessThanOrEqual(120);
    expect(withListingSlugSuffix(base, 23)).toMatch(/-23$/);
  });

  it("chooses numeric suffixes when the base slug already exists", () => {
    expect(getAvailableListingSlug("self-contain-apartment-for-rent", [])).toBe(
      "self-contain-apartment-for-rent"
    );
    expect(
      getAvailableListingSlug("self-contain-apartment-for-rent", [
        "self-contain-apartment-for-rent",
        "self-contain-apartment-for-rent-2"
      ])
    ).toBe("self-contain-apartment-for-rent-3");
  });

  it("detects legacy UUID listing identifiers", () => {
    expect(isUuidListingIdentifier("e43dcd59-4dc5-40d8-96b5-b1e7b7e35c7e")).toBe(true);
    expect(isUuidListingIdentifier("self-contain-apartment-for-rent-ikot-ekpene")).toBe(false);
  });

  it("builds public hrefs with slug first and UUID fallback", () => {
    expect(getListingHref({ id: "listing-id", slug: "self-contain-apartment-for-rent" })).toBe(
      "/listings/self-contain-apartment-for-rent"
    );
    expect(getListingHref({ id: "listing-id", slug: "" })).toBe("/listings/listing-id");
  });
});
