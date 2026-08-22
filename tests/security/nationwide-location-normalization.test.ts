import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { KNOWN_NIGERIA_AREAS, resolveKnownNigeriaArea } from "../../src/data/nigeria-known-areas";
import {
  getNigeriaLocationRegistryStats,
  normalizeNigeriaLga,
  normalizeNigeriaState
} from "../../src/lib/nigeria-locations";
import { parsePropertyMarketSegments } from "../../src/lib/property-search";
import { slugifyLocation } from "../../src/lib/sanitize";

function readSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

async function parseKeywordFilters(keyword: string, areas: Parameters<
  typeof import("../../src/modules/listings/listing.repository")["parseKeywordFilters"]
>[1]) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const repository = await import("../../src/modules/listings/listing.repository");
  return repository.parseKeywordFilters(keyword, areas);
}

describe("nationwide location normalization", () => {
  it("contains exactly 37 states/FCT and 774 canonical LGAs or area councils", () => {
    expect(getNigeriaLocationRegistryStats()).toEqual({ states: 37, lgas: 774 });
  });

  it("normalizes legacy state and LGA spellings across Nigeria", () => {
    expect(normalizeNigeriaState("Nassarawa")).toBe("Nasarawa");
    expect(normalizeNigeriaLga("Lagos", "Badagary")).toBe("Badagry");
    expect(normalizeNigeriaLga("Ebonyi", "Abakalik")).toBe("Abakaliki");
    expect(normalizeNigeriaLga("Enugu", "EnuguSou")).toBe("Enugu South");
    expect(normalizeNigeriaLga("Rivers", "Akukutor")).toBe("Akuku-Toru");
    expect(normalizeNigeriaLga("Sokoto", "Tangazar")).toBe("Tangaza");
    expect(normalizeNigeriaLga("Yobe", "Borsari")).toBe("Bursari");
    expect(normalizeNigeriaLga("Federal Capital Territory", "Municipal")).toBe("Abuja Municipal Area Council");
  });

  it("creates constraint-safe location slugs from spaces, punctuation, and accents", () => {
    expect(slugifyLocation(["Lekki Phase 1"])).toBe("lekki-phase-1");
    expect(slugifyLocation(["  Ogbia / Central -- Estate  "])).toBe("ogbia-central-estate");
    expect(slugifyLocation(["Caf\u00e9 & Gardens"])).toBe("cafe-and-gardens");
    expect(slugifyLocation(["Akwa Ibom", "Ikot Ekpene", "Aba Road"])).toBe(
      "akwa-ibom-ikot-ekpene-aba-road"
    );
  });

  it("canonicalizes legacy LGA URL segments for direct permanent redirects", () => {
    expect(parsePropertyMarketSegments(["for-rent", "lagos", "badagary"])?.path)
      .toBe("/properties/for-rent/lagos/badagry");
    expect(parsePropertyMarketSegments(["for-sale", "ebonyi", "abakalik"])?.path)
      .toBe("/properties/for-sale/ebonyi/abakaliki");
    expect(parsePropertyMarketSegments(["for-rent", "enugu", "enugu-sou"])?.path)
      .toBe("/properties/for-rent/enugu/enugu-south");
  });

  it("parses nationwide state, LGA, subtype, and registered-area keywords", async () => {
    await expect(parseKeywordFilters("self contain for rent in Ikot Ekpene Akwa Ibom", []))
      .resolves.toMatchObject({
        state: "Akwa Ibom",
        city: "Ikot Ekpene",
        propertyType: "apartment",
        propertySubtype: "self_contain",
        listingCategory: "for_rent"
      });
    await expect(parseKeywordFilters("warehouse for sale Port Harcourt Rivers", []))
      .resolves.toMatchObject({
        state: "Rivers",
        city: "Port Harcourt",
        propertyType: "commercial",
        propertySubtype: "warehouse",
        listingCategory: "for_sale"
      });
    await expect(parseKeywordFilters("mini flats Sangotedo Lagos", [{
      id: "area-1",
      state: "Lagos",
      city: "Eti-Osa",
      canonicalName: "Sangotedo",
      slug: "sangotedo",
      aliases: ["sangotedo ajah"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }])).resolves.toMatchObject({
      state: "Lagos",
      city: "Eti-Osa",
      areaSlug: "sangotedo",
      propertySubtype: "mini_flat"
    });
  });

  it("keeps high-confidence areas authoritative and unknown-area registration automatic", () => {
    expect(KNOWN_NIGERIA_AREAS.find((area) => area.slug === "sangotedo"))
      .toMatchObject({ state: "Lagos", city: "Eti-Osa" });
    expect(resolveKnownNigeriaArea("Lagos", "Sangotedo Ajah"))
      .toMatchObject({ canonicalName: "Sangotedo", city: "Eti-Osa" });
    expect(resolveKnownNigeriaArea("Akwa Ibom", "A new local estate")).toBeNull();
    const repository = readSource("src/modules/seo/seo-area.repository.ts");
    expect(repository).toContain("resolveOrRegisterSeoArea");
    expect(repository).toContain('from("seo_areas")');
    expect(repository).toContain('onConflict: "state,city,slug"');
    expect(repository).toContain("const lookupCity = knownArea?.city ?? selectedCity");
    expect(repository).not.toContain("area: existing.canonicalName");
  });

  it("ships rerunnable redirects, taxonomy repair, and an admin registry", () => {
    const schema = readSource("docs/supabase-schema.sql");
    const focusedMigration = readSource(
      "docs/supabase-migrations/20260821_listing_location_reliability.sql"
    );
    const adminRoute = readSource("src/app/api/admin/seo/areas/route.ts");
    const migration = readSource("scripts/normalize-listing-seo.mjs");
    const dailyMaintenance = readSource("src/modules/entitlements/auto-refresh.service.ts");
    expect(schema).toContain("create table if not exists public.seo_area_redirects");
    expect(schema).toContain("listings_property_taxonomy_match_check");
    expect(schema).toContain("select distinct on (old_state, old_city, old_slug)");
    expect(focusedMigration).toContain("select distinct on (old_state, old_city, old_slug)");
    expect(focusedMigration).toContain("listings_property_taxonomy_match_check");
    expect(focusedMigration).not.toMatch(/delete\s+from\s+public\.listings/i);
    expect(schema).toContain("The registered subtype determines its property group");
    expect(adminRoute).toContain("requireAdmin(request)");
    expect(adminRoute).toContain("mergeSeoAreas");
    expect(adminRoute).toContain("moveSeoArea");
    expect(migration).toContain('const apply = process.argv.includes("--apply")');
    expect(migration).toContain("slugUnchanged: listing.slug");
    expect(dailyMaintenance).toContain("seoAreas.normalizedListings > 0");
  });
});
