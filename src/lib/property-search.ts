import type { ListingCategory, PropertyType } from "@/lib/types";
import { getLgasForState, NIGERIA_STATES, normalizeNigeriaState } from "@/lib/nigeria-locations";

export const PROPERTY_CATEGORY_SEGMENTS = {
  "for-sale": "for_sale",
  "for-rent": "for_rent",
  "short-let": "short_let"
} as const satisfies Record<string, ListingCategory>;

export const PROPERTY_TYPE_SEGMENTS = {
  apartments: "apartment",
  duplexes: "duplex",
  land: "land",
  offices: "office",
  shops: "shop"
} as const satisfies Record<string, PropertyType>;

export type PropertyMarketKind = "national" | "state" | "state_category" | "city_category" | "city_type";

export type PropertyMarketRoute = {
  kind: PropertyMarketKind;
  path: string;
  state?: string;
  stateLabel?: string;
  city?: string;
  category?: ListingCategory;
  propertyType?: PropertyType;
};

export type PropertyMarketStats = {
  listingCount: number;
  latestUpdatedAt: string | null;
  duplicateRatio: number;
};

const CATEGORY_LABELS: Record<ListingCategory, string> = {
  for_sale: "for sale",
  for_rent: "for rent",
  short_let: "for short let"
};

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "apartments",
  duplex: "duplexes",
  land: "land",
  office: "offices",
  shop: "shops"
};

const STATE_PUBLIC_LABELS: Record<string, string> = {
  "Federal Capital Territory": "Abuja"
};

const STATE_SLUG_ALIASES: Record<string, string> = {
  "federal-capital-territory": "Federal Capital Territory",
  fct: "Federal Capital Territory",
  abuja: "Federal Capital Territory",
  nassarawa: "Nasarawa",
  nasarawa: "Nasarawa"
};

const CITY_SLUG_ALIASES: Record<string, string> = {
  badagry: "Badagary",
  abakaliki: "Abakalik",
  "enugu-south": "EnuguSou"
};

export const MARKET_INDEX_THRESHOLDS: Record<PropertyMarketKind, number> = {
  national: 1,
  state: 3,
  state_category: 3,
  city_category: 5,
  city_type: 8
};

export const MARKET_RECENCY_DAYS = 60;
export const MARKET_INDEX_GRACE_DAYS = 30;

export function slugifyMarketPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getPublicStateLabel(state: string) {
  return STATE_PUBLIC_LABELS[state] ?? state;
}

export function getStateSlug(state: string) {
  return slugifyMarketPart(getPublicStateLabel(state));
}

export function resolveStateSlug(slug: string) {
  const normalized = slugifyMarketPart(slug);
  if (STATE_SLUG_ALIASES[normalized]) {
    return STATE_SLUG_ALIASES[normalized];
  }

  return NIGERIA_STATES.find((state) => getStateSlug(state) === normalized) ?? null;
}

export function resolveCitySlug(state: string, slug: string) {
  const normalized = slugifyMarketPart(slug);
  const alias = CITY_SLUG_ALIASES[normalized];
  const cities = getLgasForState(state);
  if (alias && cities.includes(alias)) {
    return alias;
  }
  return cities.find((city) => slugifyMarketPart(city) === normalized) ?? null;
}

export function getCategorySegment(category: ListingCategory) {
  return Object.entries(PROPERTY_CATEGORY_SEGMENTS).find(([, value]) => value === category)?.[0] ?? "";
}

export function getPropertyTypeSegment(propertyType: PropertyType) {
  return Object.entries(PROPERTY_TYPE_SEGMENTS).find(([, value]) => value === propertyType)?.[0] ?? "";
}

export function buildPropertyMarketPath(input: {
  state?: string;
  city?: string;
  category?: ListingCategory;
  propertyType?: PropertyType;
}) {
  const parts = ["/properties"];
  if (input.category) parts.push(getCategorySegment(input.category));
  if (input.state) parts.push(getStateSlug(input.state));
  if (input.city) parts.push(slugifyMarketPart(input.city));
  if (input.propertyType) parts.push(getPropertyTypeSegment(input.propertyType));
  return parts.join("/");
}

export function parsePropertyMarketSegments(segments: string[] = []): PropertyMarketRoute | null {
  if (segments.length === 0) {
    return { kind: "national", path: "/properties" };
  }

  const category = PROPERTY_CATEGORY_SEGMENTS[segments[0] as keyof typeof PROPERTY_CATEGORY_SEGMENTS];
  if (category && segments.length === 1) {
    return {
      kind: "national",
      category,
      path: buildPropertyMarketPath({ category })
    };
  }

  if (!category && segments.length === 1) {
    const state = resolveStateSlug(segments[0]);
    return state
      ? {
          kind: "state",
          state,
          stateLabel: getPublicStateLabel(state),
          path: buildPropertyMarketPath({ state })
        }
      : null;
  }

  if (!category || segments.length < 2 || segments.length > 4) {
    return null;
  }

  const state = resolveStateSlug(segments[1]);
  if (!state) {
    return null;
  }

  const base = {
    category,
    state,
    stateLabel: getPublicStateLabel(state)
  };

  if (segments.length === 2) {
    return {
      ...base,
      kind: "state_category",
      path: buildPropertyMarketPath(base)
    };
  }

  const city = resolveCitySlug(state, segments[2]);
  if (!city) {
    return null;
  }

  if (segments.length === 3) {
    return {
      ...base,
      city,
      kind: "city_category",
      path: buildPropertyMarketPath({ ...base, city })
    };
  }

  const propertyType = PROPERTY_TYPE_SEGMENTS[segments[3] as keyof typeof PROPERTY_TYPE_SEGMENTS];
  if (!propertyType) {
    return null;
  }

  return {
    ...base,
    city,
    propertyType,
    kind: "city_type",
    path: buildPropertyMarketPath({ ...base, city, propertyType })
  };
}

export function getMarketTitle(route: PropertyMarketRoute) {
  const category = route.category ? CATEGORY_LABELS[route.category] : "across Nigeria";
  const type = route.propertyType ? `${PROPERTY_TYPE_LABELS[route.propertyType]} ` : "property ";
  const location = route.city
    ? ` in ${route.city}, ${route.stateLabel}`
    : route.stateLabel
      ? ` in ${route.stateLabel}`
      : route.category
        ? " in Nigeria"
        : "";

  if (route.kind === "national" && !route.category) {
    return "Property listings across Nigeria";
  }

  if (route.kind === "state" && route.stateLabel) {
    return `Property listings in ${route.stateLabel}`;
  }

  return `${type}${category}${location}`.replace(/\s+/g, " ").trim().replace(/^./, (character) => character.toUpperCase());
}

export function getMarketDescription(route: PropertyMarketRoute, listingCount: number) {
  const title = getMarketTitle(route).toLowerCase();
  const countText = listingCount === 1 ? "1 active listing" : `${listingCount} active listings`;
  return `Explore ${countText}: ${title} on C59 Estatehub. Compare current property details and contact approved agents directly by phone or WhatsApp.`;
}

export function getMarketIndexability(route: PropertyMarketRoute, stats: PropertyMarketStats, now = new Date()) {
  const threshold = MARKET_INDEX_THRESHOLDS[route.kind];
  const latest = stats.latestUpdatedAt ? new Date(stats.latestUpdatedAt) : null;
  const recencyCutoff = new Date(now.getTime() - MARKET_RECENCY_DAYS * 24 * 60 * 60 * 1000);
  const isRecent = Boolean(latest && !Number.isNaN(latest.getTime()) && latest >= recencyCutoff);
  const hasInventory = stats.listingCount >= threshold;
  const hasAcceptableDiversity = stats.listingCount < 3 || stats.duplicateRatio <= 0.7;

  if (!hasInventory) {
    return { eligible: false, threshold, reason: `Needs at least ${threshold} active listings.` };
  }
  if (!isRecent) {
    return { eligible: false, threshold, reason: "Needs a listing updated within the last 60 days." };
  }
  if (!hasAcceptableDiversity) {
    return { eligible: false, threshold, reason: "Needs more distinct listing content." };
  }
  return { eligible: true, threshold, reason: "Inventory, freshness, and diversity requirements are met." };
}

export function getLegacyPropertyRedirect(params: Record<string, string | string[] | undefined>) {
  const values = Object.fromEntries(
    Object.entries(params).filter(([, value]) => typeof value === "string" && value.trim())
  ) as Record<string, string>;
  const allowed = new Set(["state", "city", "listingCategory", "propertyType"]);
  if (!Object.keys(values).length || Object.keys(values).some((key) => !allowed.has(key))) {
    return null;
  }

  const normalizedState = values.state ? normalizeNigeriaState(values.state) : undefined;
  const state = normalizedState && NIGERIA_STATES.includes(normalizedState) ? normalizedState : undefined;
  const city = state && values.city && getLgasForState(state).includes(values.city) ? values.city : undefined;
  const category = Object.values(PROPERTY_CATEGORY_SEGMENTS).includes(values.listingCategory as ListingCategory)
    ? (values.listingCategory as ListingCategory)
    : undefined;
  const propertyType = Object.values(PROPERTY_TYPE_SEGMENTS).includes(values.propertyType as PropertyType)
    ? (values.propertyType as PropertyType)
    : undefined;

  if (!state || (values.city && !city) || (values.listingCategory && !category)) {
    return null;
  }
  if (propertyType && (!category || !city)) {
    return null;
  }

  return buildPropertyMarketPath({ state, city, category, propertyType });
}
