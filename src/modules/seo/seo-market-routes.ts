import { NIGERIA_STATES } from "@/lib/nigeria-locations";
import {
  buildPropertyMarketPath,
  parsePropertyMarketSegments,
  type PropertyMarketRoute
} from "@/lib/property-search";
import type { ListingRecord, PublicMarketFacet } from "@/lib/types";

type ListingMarketTarget = Pick<
  ListingRecord,
  "location" | "listingCategory" | "propertyType" | "propertySubtype" | "updatedAt"
>;

export type SeoMarketAggregate = {
  route: PropertyMarketRoute;
  listingCount: number;
  latestUpdatedAt: string | null;
  duplicateRatio: number;
  listingFingerprints: string[];
};

function getDuplicateRatio(fingerprints: string[]) {
  if (!fingerprints.length) return 0;
  const counts = new Map<string, number>();
  for (const fingerprint of fingerprints) {
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  }
  return Math.max(...counts.values()) / fingerprints.length;
}

function routeFromPath(path: string) {
  return parsePropertyMarketSegments(path.replace(/^\/properties\/?/, "").split("/").filter(Boolean));
}

export function getFacetMarketPaths(facet: PublicMarketFacet) {
  const paths = [
    "/properties",
    buildPropertyMarketPath({ category: facet.listingCategory }),
    buildPropertyMarketPath({ category: facet.listingCategory, propertyType: facet.propertyType }),
    buildPropertyMarketPath({ state: facet.state }),
    buildPropertyMarketPath({ state: facet.state, category: facet.listingCategory }),
    buildPropertyMarketPath({
      state: facet.state,
      category: facet.listingCategory,
      propertyType: facet.propertyType
    }),
    buildPropertyMarketPath({
      state: facet.state,
      city: facet.city,
      category: facet.listingCategory
    }),
    buildPropertyMarketPath({
      state: facet.state,
      city: facet.city,
      category: facet.listingCategory,
      propertyType: facet.propertyType
    })
  ];

  if (facet.propertySubtype) {
    paths.push(
      buildPropertyMarketPath({ category: facet.listingCategory, propertySubtype: facet.propertySubtype }),
      buildPropertyMarketPath({
        state: facet.state,
        category: facet.listingCategory,
        propertySubtype: facet.propertySubtype
      }),
      buildPropertyMarketPath({
        state: facet.state,
        city: facet.city,
        category: facet.listingCategory,
        propertySubtype: facet.propertySubtype
      })
    );
  }

  if (facet.areaSlug) {
    paths.push(
      buildPropertyMarketPath({
        state: facet.state,
        city: facet.city,
        areaSlug: facet.areaSlug,
        category: facet.listingCategory
      })
    );
    if (facet.propertySubtype) {
      paths.push(
        buildPropertyMarketPath({
          state: facet.state,
          city: facet.city,
          areaSlug: facet.areaSlug,
          category: facet.listingCategory,
          propertySubtype: facet.propertySubtype
        })
      );
    }
  }

  return Array.from(new Set(paths));
}

export function getListingMarketPaths(listing: ListingMarketTarget) {
  return getFacetMarketPaths({
    state: listing.location.state,
    city: listing.location.city,
    area: listing.location.area,
    areaSlug: listing.location.areaSlug ?? "",
    listingCategory: listing.listingCategory,
    propertyType: listing.propertyType,
    propertySubtype: listing.propertySubtype ?? null,
    listingCount: 1,
    latestUpdatedAt: listing.updatedAt,
    listingFingerprints: []
  });
}

export function aggregateSeoMarkets(facets: PublicMarketFacet[]) {
  const markets = new Map<string, SeoMarketAggregate>();

  function ensure(path: string) {
    if (markets.has(path)) return;
    const route = routeFromPath(path);
    if (route) {
      markets.set(path, {
        route,
        listingCount: 0,
        latestUpdatedAt: null,
        duplicateRatio: 0,
        listingFingerprints: []
      });
    }
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
  for (const state of NIGERIA_STATES) {
    ensure(buildPropertyMarketPath({ state }));
  }

  for (const facet of facets) {
    for (const path of getFacetMarketPaths(facet)) {
      add(path, facet);
    }
  }

  return [...markets.values()];
}
