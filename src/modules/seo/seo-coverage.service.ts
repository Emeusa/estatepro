import {
  getMarketTitle,
} from "@/lib/property-search";
import type { SeoMarketCoverageRecord } from "@/lib/types";
import { getPublicMarketFacets } from "@/modules/listings/listing.service";
import { getSeoIndexingStatusesByPath } from "@/modules/seo/seo-indexing.repository";
import { resolveMarketIndexability } from "@/modules/seo/seo-market.service";
import { aggregateSeoMarkets } from "@/modules/seo/seo-market-routes";

export async function getSeoMarketCoverage(): Promise<SeoMarketCoverageRecord[]> {
  const markets = aggregateSeoMarkets(await getPublicMarketFacets());
  const decisions = await Promise.all(markets.map(async (market) => {
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

  const statuses = await getSeoIndexingStatusesByPath(decisions.map((market) => market.path));
  const rows = decisions.map((market) => {
    const status = statuses.get(market.path);
    return {
      ...market,
      discoverable: market.isIndexable,
      googleIndexed: status?.googleIndexed ?? false,
      googleVerdict: status?.googleVerdict ?? null,
      coverageState: status?.coverageState ?? null,
      technicalIssue: status?.technicalIssue ?? false,
      lastInspectedAt: status?.lastInspectedAt ?? null,
      lastCrawlTime: status?.lastCrawlTime ?? null,
      userCanonical: status?.userCanonical ?? null,
      googleCanonical: status?.googleCanonical ?? null
    };
  });

  return rows.sort((first, second) => second.listingCount - first.listingCount || first.path.localeCompare(second.path));
}
