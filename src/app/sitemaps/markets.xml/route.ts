import { getSiteUrl } from "@/lib/seo";
import { createUrlSet, xmlResponse } from "@/lib/sitemap-xml";
import { getPublicMarketFacets } from "@/modules/listings/listing.service";
import { resolveMarketIndexability } from "@/modules/seo/seo-market.service";
import { aggregateSeoMarkets } from "@/modules/seo/seo-market-routes";

export async function GET() {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  const aggregates = aggregateSeoMarkets(await getPublicMarketFacets());

  const eligible = [];
  for (const aggregate of aggregates) {
    const decision = await resolveMarketIndexability(aggregate.route, aggregate);
    if (decision.eligible) eligible.push(aggregate);
  }

  return xmlResponse(createUrlSet([
    { url: siteUrl, lastModified: eligible[0]?.latestUpdatedAt ?? undefined },
    { url: `${siteUrl}/properties/locations`, lastModified: eligible[0]?.latestUpdatedAt ?? undefined },
    ...eligible.map((market) => ({
      url: `${siteUrl}${market.route.path}`,
      lastModified: market.latestUpdatedAt ?? undefined
    }))
  ]));
}
