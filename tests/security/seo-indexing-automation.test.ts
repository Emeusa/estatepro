import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { PublicMarketFacet } from "../../src/lib/types";
import {
  classifySeoInspection,
  getNextSeoInspectionAt
} from "../../src/modules/seo/seo-inspection";
import { getFacetMarketPaths } from "../../src/modules/seo/seo-market-routes";

function readSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("automatic SEO discovery", () => {
  it("derives the complete affected hierarchy from a new listing market", () => {
    const facet: PublicMarketFacet = {
      state: "Lagos",
      city: "Eti-Osa",
      area: "Sangotedo",
      areaSlug: "sangotedo",
      listingCategory: "for_rent",
      propertyType: "apartment",
      propertySubtype: "mini_flat",
      listingCount: 1,
      latestUpdatedAt: "2026-08-19T10:00:00.000Z",
      listingFingerprints: ["mini-flat|sangotedo"]
    };

    expect(getFacetMarketPaths(facet)).toEqual(expect.arrayContaining([
      "/properties",
      "/properties/for-rent",
      "/properties/for-rent/apartments",
      "/properties/lagos",
      "/properties/for-rent/lagos",
      "/properties/for-rent/lagos/eti-osa",
      "/properties/for-rent/lagos/eti-osa/sangotedo",
      "/properties/for-rent/lagos/eti-osa/sangotedo/mini-flats"
    ]));
  });

  it("revalidates listing and market sitemaps without blocking the mutation response", () => {
    const cache = readSource("src/modules/listings/listing-cache.ts");
    const marketService = readSource("src/modules/seo/seo-market.service.ts");
    const updateRoute = readSource("src/app/api/listings/[listingId]/route.ts");

    expect(cache).toContain('safeRevalidatePath("/sitemaps/listings.xml")');
    expect(cache).toContain('safeRevalidatePath("/sitemaps/markets.xml")');
    expect(cache).toContain('safeRevalidatePath("/properties/locations")');
    expect(cache).toContain("after(async () =>");
    expect(cache).toContain('await import("@/modules/seo/seo-discovery.service")');
    expect(cache).toContain("deferred market refresh failed");
    expect(cache).toContain("previousListing ? getListingMarketPaths(previousListing) : []");
    expect(updateRoute).toContain("revalidateListingMutationPaths(listing, previousListing)");
    expect(marketService).toContain("baseline.eligible && !previous?.first_eligible_at");
  });

  it("paginates Supabase reads so growing inventory is not capped at 1,000 URLs", () => {
    const listings = readSource("src/modules/listings/listing.repository.ts");
    const indexing = readSource("src/modules/seo/seo-indexing.repository.ts");

    expect(listings).toContain("export async function listPublicListingSitemapEntries");
    expect(listings).toContain("const safeLimit = Math.min(45000");
    expect(listings).toContain(".range(from, to)");
    expect(listings).toContain("for (let from = 0; from < 45000;)");
    expect(indexing).toContain("for (let from = 0; from < 50000; from += 1000)");
    expect(indexing).toContain(".range(from, from + 999)");
  });

  it("exposes crawlable listing-to-market links without JavaScript", () => {
    const listingPage = readSource("src/app/listings/[listingId]/page.tsx");

    expect(listingPage).toContain('aria-label="Browse related property markets"');
    expect(listingPage).toContain("<Link href={statePath}");
    expect(listingPage).toContain("<Link href={marketPath}");
    expect(listingPage).toContain("<Link href={areaPath}");
    expect(listingPage).toContain("<Link href={subtypePath}");
  });

  it("canonicalizes uniquely registered areas away from legacy wrong-LGA paths", () => {
    const repository = readSource("src/modules/seo/seo-area.repository.ts");
    const marketPage = readSource("src/app/properties/[[...segments]]/page.tsx");

    expect(repository).toContain("if (stateMatches.length === 1)");
    expect(repository).toContain("return toSeoAreaRecord(stateMatches[0])");
    expect(marketPage).toContain("city: registeredArea.city");
    expect(marketPage).toContain("permanentRedirect(context.route.path)");
  });
});

describe("Search Console inspection monitoring", () => {
  it("distinguishes explicit technical failures from not-yet-inspected states", () => {
    expect(classifySeoInspection({
      verdict: "PASS",
      robotsTxtState: "ALLOWED",
      indexingState: "INDEXING_ALLOWED",
      pageFetchState: "SUCCESSFUL",
      userCanonical: "https://c59estatehub.com/properties/lagos",
      googleCanonical: "https://c59estatehub.com/properties/lagos/"
    })).toEqual({ googleIndexed: true, technicalIssue: false, canonicalMismatch: false });

    expect(classifySeoInspection({
      verdict: "VERDICT_UNSPECIFIED",
      robotsTxtState: "ROBOTS_TXT_STATE_UNSPECIFIED",
      indexingState: "INDEXING_STATE_UNSPECIFIED",
      pageFetchState: "PAGE_FETCH_STATE_UNSPECIFIED"
    })).toEqual({ googleIndexed: false, technicalIssue: false, canonicalMismatch: false });

    expect(classifySeoInspection({
      verdict: "FAIL",
      robotsTxtState: "DISALLOWED",
      indexingState: "BLOCKED_BY_META_TAG",
      pageFetchState: "NOT_FOUND"
    }).technicalIssue).toBe(true);

    expect(classifySeoInspection({
      verdict: "NEUTRAL",
      userCanonical: "https://c59estatehub.com/",
      googleCanonical: "https://www.c59estatehub.com/"
    })).toMatchObject({ googleIndexed: false, technicalIssue: true, canonicalMismatch: true });
  });

  it("uses the 3, 10, and 30 day monitoring lifecycle with safe retries", () => {
    const eligibleAt = "2026-08-01T00:00:00.000Z";
    const healthy = { googleIndexed: false, technicalIssue: false, canonicalMismatch: false };
    const technical = { googleIndexed: false, technicalIssue: true, canonicalMismatch: false };
    const indexed = { googleIndexed: true, technicalIssue: false, canonicalMismatch: false };

    expect(getNextSeoInspectionAt(eligibleAt, new Date("2026-08-04T00:00:00.000Z"), healthy).toISOString())
      .toBe("2026-08-11T00:00:00.000Z");
    expect(getNextSeoInspectionAt(eligibleAt, new Date("2026-08-11T00:00:00.000Z"), healthy).toISOString())
      .toBe("2026-08-31T00:00:00.000Z");
    expect(getNextSeoInspectionAt(eligibleAt, new Date("2026-09-01T00:00:00.000Z"), healthy).toISOString())
      .toBe("2026-09-08T00:00:00.000Z");
    expect(getNextSeoInspectionAt(eligibleAt, new Date("2026-08-04T00:00:00.000Z"), technical).toISOString())
      .toBe("2026-08-05T00:00:00.000Z");
    expect(getNextSeoInspectionAt(eligibleAt, new Date("2026-08-04T00:00:00.000Z"), indexed).toISOString())
      .toBe("2026-09-03T00:00:00.000Z");
  });

  it("uses only the read-only URL Inspection API with a daily cap", () => {
    const service = readSource("src/modules/seo/search-console.service.ts");
    const env = readSource(".env.example");

    expect(service).toContain("https://www.googleapis.com/auth/webmasters.readonly");
    expect(service).toContain("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect");
    expect(service).toContain("Math.min(100");
    expect(service).not.toContain("indexing.googleapis.com");
    expect(env).toContain("GOOGLE_SEARCH_CONSOLE_ENABLED=false");
    expect(env).not.toContain("NEXT_PUBLIC_GOOGLE_SEARCH_CONSOLE");
  });

  it("keeps cron failures isolated and makes alerts idempotent", () => {
    const cron = readSource("src/modules/entitlements/auto-refresh.service.ts");
    const repository = readSource("src/modules/seo/seo-indexing.repository.ts");
    const schema = readSource("docs/supabase-schema.sql");

    expect(cron).toContain("runSeoIndexingMaintenance");
    expect(cron).toContain('operation: "seo_indexing_maintenance"');
    expect(repository).toContain('onConflict: "dedupe_key"');
    expect(repository).toContain("ignoreDuplicates: true");
    expect(schema).toContain("create table if not exists public.seo_indexing_status");
    expect(schema).toContain("revoke all on public.seo_indexing_status from anon, authenticated");
    expect(schema).toContain("admin_notifications_dedupe_key_unique_idx");
  });

  it("surfaces all monitored URL families in the admin-only SEO API", () => {
    const route = readSource("src/app/api/admin/seo/route.ts");
    const page = readSource("src/app/admin/seo/page.tsx");

    expect(route).toContain("requireAdmin(request)");
    expect(route).toContain("listSeoIndexingStatuses");
    expect(route).toContain("markets,");
    expect(route).toContain("indexing,");
    expect(route).toContain("generatedAt: new Date().toISOString()");
    expect(page).toContain("Monitored canonical URLs");
    expect(page).toContain("Google indexed");
    expect(page).toContain("Technical issues");
  });
});
