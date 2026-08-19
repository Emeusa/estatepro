import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPropertyMarketPath,
  getMarketSeoTitle,
  parsePropertyMarketSegments
} from "../../src/lib/property-search";
import { PROPERTY_SUBTYPES } from "../../src/lib/property-taxonomy";

function readSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("nationwide SEO architecture", () => {
  it("uses national homepage positioning and inventory-driven market links", () => {
    const homepage = readSource("src/app/page.tsx");
    const footer = readSource("src/components/layout/footer.tsx");

    expect(homepage).toContain("Verified property listings across Nigeria");
    expect(homepage).toContain("getPublicMarketFacets");
    expect(homepage).not.toMatch(/Uyo[- ]based/i);
    expect(footer).toContain("getPublicMarketFacets");
    expect(footer).toContain("/properties/locations");
    expect(readSource("src/lib/homepage-filters.ts")).toContain(
      "C59 Estatehub - Verified Properties Across Nigeria"
    );
    expect(homepage).toContain("Find verified properties for rent, sale, and short let across Nigeria.");
  });

  it("supports broad property groups, nationwide subtypes, and neighborhood routes", () => {
    expect(PROPERTY_SUBTYPES.apartment).toContain("mini_flat");
    expect(PROPERTY_SUBTYPES.house).toContain("detached_duplex");
    expect(PROPERTY_SUBTYPES.room).toContain("room_and_parlour");
    expect(PROPERTY_SUBTYPES.land).toContain("joint_venture_land");
    expect(PROPERTY_SUBTYPES.commercial).toContain("warehouse");

    const route = parsePropertyMarketSegments([
      "for-rent",
      "lagos",
      "eti-osa",
      "sangotedo",
      "mini-flat"
    ]);
    expect(route).toMatchObject({
      kind: "area_subtype",
      state: "Lagos",
      city: "Eti-Osa",
      areaSlug: "sangotedo",
      propertySubtype: "mini_flat",
      path: "/properties/for-rent/lagos/eti-osa/sangotedo/mini-flats"
    });
    expect(buildPropertyMarketPath({ category: "for_sale", propertyType: "commercial" }))
      .toBe("/properties/for-sale/commercial");
    expect(getMarketSeoTitle({ ...route!, area: "Sangotedo" }, 12))
      .toBe("Mini flats for rent in Sangotedo, Lagos (12 available) | C59 Estatehub");
  });

  it("keeps taxonomy schema additive and creates direct redirect boundaries", () => {
    const schema = readSource("docs/supabase-schema.sql");
    const middleware = readSource("src/middleware.ts");
    const uuidResolver = readSource("src/app/api/listings/legacy-redirect/[listingId]/route.ts");

    expect(schema).toContain("add column if not exists property_subtype text");
    expect(schema).toContain("add column if not exists area_slug text");
    expect(schema).toContain("create table if not exists public.seo_areas");
    expect(middleware).toContain("NextResponse.redirect(new URL(redirectPath, request.url), 308)");
    expect(middleware).toContain("NextResponse.rewrite(resolverUrl)");
    expect(uuidResolver).toContain("NextResponse.redirect");
    expect(uuidResolver).toContain(", 308)");
  });

  it("serves one responsive listing result structure with crawlable pagination", () => {
    const grid = readSource("src/components/listings/listing-grid.tsx");
    const pagination = readSource("src/components/listings/pagination-nav.tsx");
    const result = readSource("src/components/listings/listing-result.tsx");

    expect(grid).toContain("ListingResult");
    expect(grid).not.toContain('from "@/components/listings/listing-desktop-row"');
    expect(grid).not.toContain('from "@/components/listings/listing-card"');
    expect(grid).toContain("PaginationNav");
    expect(grid).not.toContain("Load more properties");
    expect(pagination).toContain("Showing {firstItem}-{lastItem} of {totalItems}");
    expect(pagination).toContain("currentPage - 2");
    expect(result).toContain("whitespace-nowrap");
    expect(result).toContain('className="h-3.5 w-3.5 shrink-0 fill-current"');
    expect(result).toMatch(/>\s*Call\s*<\/a>/);
    expect(result).not.toContain("Call agent");
  });

  it("slices one cached global ranking snapshot instead of using cursors", () => {
    const service = readSource("src/modules/listings/listing.service.ts");
    const repository = readSource("src/modules/listings/listing.repository.ts");
    const api = readSource("src/app/api/listings/route.ts");

    expect(service).toContain("getCachedPublicRankingSnapshot");
    expect(service).toContain("const { page, limit, ...rankingFilters } = filters");
    expect(repository).toContain("paginateRankedPublicListings");
    expect(repository).toContain("PUBLIC_RANKING_COLUMNS");
    expect(api).toContain('page: searchParams.get("page")');
    expect(api).not.toContain('searchParams.get("cursor")');
  });

  it("keeps mobile listing text contained and reduces mobile feature density", () => {
    const result = readSource("src/components/listings/listing-result.tsx");
    const detail = readSource("src/components/listings/listing-detail.tsx");

    expect(result).toContain("whitespace-normal break-words leading-5 [overflow-wrap:anywhere]");
    expect(result).not.toContain('<span className="truncate">{listing.location.area}');
    expect(result).toContain('index >= 3 ? "hidden sm:inline-flex" : "inline-flex"');
    expect(result).toContain("line-clamp-2 max-w-full break-words");
    expect(detail).toContain("whitespace-pre-wrap break-words");
    expect(detail).toContain("[overflow-wrap:anywhere]");
  });

  it("keeps listing prices separate from the category and save row", () => {
    const result = readSource("src/components/listings/listing-result.tsx");
    const priceIndex = result.indexOf("{formatPrice(listing.price)}");
    const categoryIndex = result.indexOf("{LISTING_CATEGORY_LABELS[listing.listingCategory]}", priceIndex);
    const saveIndex = result.indexOf("<SaveListingButton", categoryIndex);

    expect(result).toContain("w-full whitespace-nowrap text-lg font-black");
    expect(result).toContain("xl:text-[0.95rem] 2xl:text-base");
    expect(result).toContain('className="mt-2 flex items-center justify-between gap-2"');
    expect(priceIndex).toBeGreaterThan(-1);
    expect(categoryIndex).toBeGreaterThan(priceIndex);
    expect(saveIndex).toBeGreaterThan(categoryIndex);
  });

  it("splits canonical sitemap output by listings, markets, and guides", () => {
    const root = readSource("src/app/sitemap.xml/route.ts");
    const markets = readSource("src/app/sitemaps/markets.xml/route.ts");
    const marketRoutes = readSource("src/modules/seo/seo-market-routes.ts");

    expect(root).toContain("/sitemaps/listings.xml");
    expect(root).toContain("/sitemaps/markets.xml");
    expect(root).toContain("/sitemaps/guides.xml");
    expect(markets).toContain("resolveMarketIndexability");
    expect(markets).toContain("decision.eligible");
    expect(markets).toContain("aggregateSeoMarkets");
    expect(marketRoutes).toContain("duplicateRatio");
  });

  it("keeps advanced filters noindex and adds market/listing structured data", () => {
    const marketPage = readSource("src/app/properties/[[...segments]]/page.tsx");
    const listingPage = readSource("src/app/listings/[listingId]/page.tsx");

    expect(marketPage).toContain("hasAdvancedFilters");
    expect(marketPage).toContain("index: false, follow: true");
    expect(marketPage).toContain('"@type": "BreadcrumbList"');
    expect(marketPage).toContain('"@type": "ItemList"');
    expect(listingPage).toContain('"@type": "RealEstateListing"');
    expect(listingPage).toContain('"@type": "Offer"');
    expect(listingPage).toContain("permanentRedirect(getListingHref(listing))");
  });

  it("adds permanent www consolidation and an admin-only SEO coverage endpoint", () => {
    const config = readSource("next.config.mjs");
    const route = readSource("src/app/api/admin/seo/route.ts");
    const adminShell = readSource("src/components/admin/admin-shell.tsx");

    expect(config).toContain('value: "www.c59estatehub.com"');
    expect(config).toContain('destination: "https://c59estatehub.com/:path*"');
    expect(config).toContain("permanent: true");
    expect(route).toContain("requireAdmin(request)");
    expect(route).toContain("RATE_LIMITS.admin");
    expect(adminShell).toContain('href: "/admin/seo"');
  });

  it("ships auditable national guides with authors, reviewers, dates, and sources", () => {
    const guides = readSource("src/content/guides.ts");
    expect(guides).toContain("author:");
    expect(guides).toContain("reviewer:");
    expect(guides).toContain("publishedAt:");
    expect(guides).toContain("updatedAt:");
    expect(guides).toContain("sources:");
  });
});
