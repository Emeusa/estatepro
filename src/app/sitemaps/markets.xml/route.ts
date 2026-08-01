import {
  buildPropertyMarketPath,
  parsePropertyMarketSegments,
  type PropertyMarketRoute
} from "@/lib/property-search";
import { getSiteUrl } from "@/lib/seo";
import { createUrlSet, xmlResponse } from "@/lib/sitemap-xml";
import { getPublicMarketFacets } from "@/modules/listings/listing.service";
import { resolveMarketIndexability } from "@/modules/seo/seo-market.service";

type Aggregate = {
  route: PropertyMarketRoute;
  listingCount: number;
  latestUpdatedAt: string;
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

export async function GET() {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  const facets = await getPublicMarketFacets();
  const aggregates = new Map<string, Aggregate>();

  function add(path: string, count: number, updatedAt: string, fingerprints: string[]) {
    const route = routeFromPath(path);
    if (!route) return;
    const current = aggregates.get(path);
    aggregates.set(path, {
      route,
      listingCount: (current?.listingCount ?? 0) + count,
      latestUpdatedAt: !current || updatedAt > current.latestUpdatedAt ? updatedAt : current.latestUpdatedAt,
      duplicateRatio: getDuplicateRatio([...(current?.listingFingerprints ?? []), ...fingerprints]),
      listingFingerprints: [...(current?.listingFingerprints ?? []), ...fingerprints]
    });
  }

  for (const facet of facets) {
    add("/properties", facet.listingCount, facet.latestUpdatedAt, facet.listingFingerprints);
    add(buildPropertyMarketPath({ category: facet.listingCategory }), facet.listingCount, facet.latestUpdatedAt, facet.listingFingerprints);
    add(buildPropertyMarketPath({ state: facet.state }), facet.listingCount, facet.latestUpdatedAt, facet.listingFingerprints);
    add(buildPropertyMarketPath({ state: facet.state, category: facet.listingCategory }), facet.listingCount, facet.latestUpdatedAt, facet.listingFingerprints);
    add(buildPropertyMarketPath({ state: facet.state, city: facet.city, category: facet.listingCategory }), facet.listingCount, facet.latestUpdatedAt, facet.listingFingerprints);
    add(buildPropertyMarketPath({ state: facet.state, city: facet.city, category: facet.listingCategory, propertyType: facet.propertyType }), facet.listingCount, facet.latestUpdatedAt, facet.listingFingerprints);
  }

  const eligible = [];
  for (const aggregate of aggregates.values()) {
    const decision = await resolveMarketIndexability(aggregate.route, aggregate);
    if (decision.eligible) eligible.push(aggregate);
  }

  return xmlResponse(createUrlSet([
    { url: siteUrl, lastModified: eligible[0]?.latestUpdatedAt },
    { url: `${siteUrl}/properties/locations`, lastModified: eligible[0]?.latestUpdatedAt },
    ...eligible.map((market) => ({ url: `${siteUrl}${market.route.path}`, lastModified: market.latestUpdatedAt }))
  ]));
}
