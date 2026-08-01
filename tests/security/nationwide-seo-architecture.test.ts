import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

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
  });

  it("serves one responsive listing result structure with crawlable pagination", () => {
    const grid = readSource("src/components/listings/listing-grid.tsx");

    expect(grid).toContain("ListingResult");
    expect(grid).not.toContain('from "@/components/listings/listing-desktop-row"');
    expect(grid).not.toContain('from "@/components/listings/listing-card"');
    expect(grid).toContain('aria-label="Property result pages"');
    expect(grid).toContain("pagination.basePath");
  });

  it("splits canonical sitemap output by listings, markets, and guides", () => {
    const root = readSource("src/app/sitemap.xml/route.ts");
    const markets = readSource("src/app/sitemaps/markets.xml/route.ts");

    expect(root).toContain("/sitemaps/listings.xml");
    expect(root).toContain("/sitemaps/markets.xml");
    expect(root).toContain("/sitemaps/guides.xml");
    expect(markets).toContain("resolveMarketIndexability");
    expect(markets).toContain("decision.eligible");
    expect(markets).toContain("duplicateRatio");
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
