import { NIGERIA_STATES } from "@/lib/nigeria-locations";
import {
  buildPropertyMarketPath,
  getMarketTitle,
  parsePropertyMarketSegments,
  type PropertyMarketRoute
} from "@/lib/property-search";
import type { PublicMarketFacet, SeoMarketCoverageRecord } from "@/lib/types";
import { getPublicMarketFacets } from "@/modules/listings/listing.service";
import { resolveMarketIndexability } from "@/modules/seo/seo-market.service";

type Aggregate = {
  route: PropertyMarketRoute;
  listingCount: number;
  latestUpdatedAt: string | null;
  duplicateRatio: number;
  listingFingerprints: string[];
};

function getDuplicateRatio(fingerprints: string[]) {
  if (!fingerprints.length) return 0;
  const counts = new Map<string, number>();
  for (const fingerprint of fingerprints) counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  return Math.max(...counts.values()) / fingerprints.length;
}

function routeFromPath(path: string) {
  return parsePropertyMarketSegments(path.replace(/^\/properties\/?/, "").split("/").filter(Boolean));
}

export function aggregateSeoMarkets(facets: PublicMarketFacet[]) {
  const markets = new Map<string, Aggregate>();

  function ensure(path: string) {
    if (markets.has(path)) return;
    const route = routeFromPath(path);
    if (route) markets.set(path, { route, listingCount: 0, latestUpdatedAt: null, duplicateRatio: 0, listingFingerprints: [] });
  }

  function add(path: string, facet: PublicMarketFacet) {
    ensure(path);
    const market = markets.get(path);
    if (!market) return;
    market.listingCount += facet.listingCount;
    market.listingFingerprints.push(...facet.listingFingerprints);
    market.duplicateRatio = getDuplicateRatio(market.listingFingerprints);
    if (!market.latestUpdatedAt || facet.latestUpdatedAt > market.latestUpdatedAt) {
      market.latestUpdatedAt = facet.latestUpdatedAt;
    }
  }

  ensure("/properties");
  ensure("/properties/for-rent");
  ensure("/properties/for-sale");
  ensure("/properties/short-let");
  for (const state of NIGERIA_STATES) ensure(buildPropertyMarketPath({ state }));

  for (const facet of facets) {
    add("/properties", facet);
    add(buildPropertyMarketPath({ category: facet.listingCategory }), facet);
    add(buildPropertyMarketPath({ state: facet.state }), facet);
    add(buildPropertyMarketPath({ state: facet.state, category: facet.listingCategory }), facet);
    add(buildPropertyMarketPath({ state: facet.state, city: facet.city, category: facet.listingCategory }), facet);
    add(buildPropertyMarketPath({ state: facet.state, city: facet.city, category: facet.listingCategory, propertyType: facet.propertyType }), facet);
  }

  return [...markets.values()];
}

export async function getSeoMarketCoverage(): Promise<SeoMarketCoverageRecord[]> {
  const markets = aggregateSeoMarkets(await getPublicMarketFacets());
  const rows = await Promise.all(markets.map(async (market) => {
    const decision = await resolveMarketIndexability(market.route, market);
    return {
      path: market.route.path,
      pageType: market.route.kind,
      label: getMarketTitle(market.route),
      listingCount: market.listingCount,
      latestUpdatedAt: market.latestUpdatedAt,
      isIndexable: decision.eligible,
      isInGracePeriod: decision.inGracePeriod,
      reason: decision.reason,
      inSitemap: decision.eligible
    };
  }));

  return rows.sort((first, second) => second.listingCount - first.listingCount || first.path.localeCompare(second.path));
}
