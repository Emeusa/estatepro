import { PROPERTY_GUIDES } from "@/content/guides";
import { getSiteUrl } from "@/lib/seo";
import { listPublicListingSitemapEntries } from "@/modules/listings/listing.repository";
import { getPublicMarketFacets } from "@/modules/listings/listing.service";
import { syncSeoIndexTargets, type SeoIndexTargetInput } from "@/modules/seo/seo-indexing.repository";
import { resolveMarketIndexability } from "@/modules/seo/seo-market.service";
import { aggregateSeoMarkets } from "@/modules/seo/seo-market-routes";

export async function refreshSeoMarketEligibility(paths?: string[]) {
  const requestedPaths = paths?.length ? new Set(paths) : null;
  const markets = aggregateSeoMarkets(await getPublicMarketFacets())
    .filter((market) => !requestedPaths || requestedPaths.has(market.route.path));
  let eligible = 0;
  for (const market of markets) {
    const decision = await resolveMarketIndexability(market.route, market);
    if (decision.eligible) eligible += 1;
  }
  return { evaluated: markets.length, eligible };
}

export async function collectSeoIndexTargets(): Promise<SeoIndexTargetInput[]> {
  const [listingEntries, marketFacets] = await Promise.all([
    listPublicListingSitemapEntries(45000),
    getPublicMarketFacets()
  ]);
  const marketAggregates = aggregateSeoMarkets(marketFacets);
  const eligibleMarkets = [];
  for (const market of marketAggregates) {
    const decision = await resolveMarketIndexability(market.route, market);
    if (decision.eligible) eligibleMarkets.push(market);
  }

  const latestMarketUpdate = eligibleMarkets
    .map((market) => market.latestUpdatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => second.localeCompare(first))[0] ?? null;

  return [
    { path: "/", pageFamily: "homepage", inSitemap: true, lastModifiedAt: latestMarketUpdate },
    { path: "/properties/locations", pageFamily: "market", inSitemap: true, lastModifiedAt: latestMarketUpdate },
    ...listingEntries.map((listing) => ({
      path: `/listings/${listing.slug}`,
      pageFamily: "listing" as const,
      inSitemap: true,
      lastModifiedAt: listing.updatedAt
    })),
    ...eligibleMarkets.map((market) => ({
      path: market.route.path,
      pageFamily: "market" as const,
      inSitemap: true,
      lastModifiedAt: market.latestUpdatedAt
    })),
    { path: "/guides", pageFamily: "guide", inSitemap: true, lastModifiedAt: PROPERTY_GUIDES[0]?.updatedAt ?? null },
    ...PROPERTY_GUIDES.map((guide) => ({
      path: `/guides/${guide.slug}`,
      pageFamily: "guide" as const,
      inSitemap: true,
      lastModifiedAt: guide.updatedAt
    }))
  ];
}

export async function syncSeoDiscoveryTargets() {
  return syncSeoIndexTargets(await collectSeoIndexTargets());
}

export function getAbsoluteSeoUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}
