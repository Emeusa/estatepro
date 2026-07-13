import type { Metadata } from "next";

import { DEFAULT_SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import type { ListingCategory, PropertyType } from "@/lib/types";

export const homeTitle = `Verified Property Listings in Nigeria | ${SITE_NAME}`;

export const HOMEPAGE_FILTER_KEYS = [
  "q",
  "state",
  "city",
  "minPrice",
  "maxPrice",
  "bedrooms",
  "bathrooms",
  "propertyType",
  "listingCategory"
] as const;

const validPropertyTypes = new Set<PropertyType>(["apartment", "duplex", "land", "office", "shop"]);
const validListingCategories = new Set<ListingCategory>(["for_sale", "for_rent", "short_let"]);

export type HomeSearchParams = Record<string, string | string[] | undefined>;

function stringParam(params: HomeSearchParams, key: string) {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberParam(params: HomeSearchParams, key: string) {
  const value = stringParam(params, key);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function propertyTypeParam(params: HomeSearchParams) {
  const value = stringParam(params, "propertyType");
  return value && validPropertyTypes.has(value as PropertyType) ? value : undefined;
}

function listingCategoryParam(params: HomeSearchParams) {
  const value = stringParam(params, "listingCategory");
  return value && validListingCategories.has(value as ListingCategory) ? value : undefined;
}

export function getHomepageFilterValues(params: HomeSearchParams) {
  return {
    initialKeyword: stringParam(params, "q"),
    initialState: stringParam(params, "state"),
    initialCity: stringParam(params, "city"),
    initialMinPrice: numberParam(params, "minPrice"),
    initialMaxPrice: numberParam(params, "maxPrice"),
    initialBedrooms: numberParam(params, "bedrooms"),
    initialBathrooms: numberParam(params, "bathrooms"),
    initialType: propertyTypeParam(params),
    initialCategory: listingCategoryParam(params)
  };
}

export function getHomepageListingQueryParams(params: HomeSearchParams) {
  const filters = getHomepageFilterValues(params);

  return {
    q: filters.initialKeyword,
    state: filters.initialState,
    city: filters.initialCity,
    minPrice: stringParam(params, "minPrice"),
    maxPrice: stringParam(params, "maxPrice"),
    bedrooms: stringParam(params, "bedrooms"),
    bathrooms: stringParam(params, "bathrooms"),
    propertyType: filters.initialType,
    listingCategory: filters.initialCategory
  };
}

export function hasHomepageActiveFilters(params: HomeSearchParams) {
  const filters = getHomepageListingQueryParams(params);
  return Object.values(filters).some(Boolean);
}

export function buildHomepageMetadata(params: HomeSearchParams): Metadata {
  const hasFilteredQuery = hasHomepageActiveFilters(params);

  return {
    title: {
      absolute: homeTitle
    },
    description: DEFAULT_SITE_DESCRIPTION,
    alternates: {
      canonical: "/"
    },
    robots: hasFilteredQuery
      ? {
          index: false,
          follow: true
        }
      : undefined,
    openGraph: {
      title: homeTitle,
      description: DEFAULT_SITE_DESCRIPTION,
      url: "/",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: homeTitle,
      description: DEFAULT_SITE_DESCRIPTION
    }
  };
}
