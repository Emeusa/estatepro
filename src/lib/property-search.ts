import type { ListingCategory, PropertySubtype, PropertyType } from "@/lib/types";
import { getLgasForState, NIGERIA_STATES, normalizeNigeriaState } from "@/lib/nigeria-locations";
import {
  getPropertySubtypeSegment,
  PROPERTY_SUBTYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPE_SEGMENTS,
  resolvePropertySubtypeSegment
} from "@/lib/property-taxonomy";

export const PROPERTY_CATEGORY_SEGMENTS = {
  "for-sale": "for_sale",
  "for-rent": "for_rent",
  "short-let": "short_let"
} as const satisfies Record<string, ListingCategory>;

const PROPERTY_TYPE_ROUTE_ALIASES: Record<string, PropertyType> = {
  apartments: "apartment",
  apartment: "apartment",
  flats: "apartment",
  houses: "house",
  house: "house",
  duplexes: "house",
  duplex: "house",
  rooms: "room",
  room: "room",
  land: "land",
  lands: "land",
  commercial: "commercial",
  "commercial-property": "commercial",
  offices: "commercial",
  office: "commercial",
  shops: "commercial",
  shop: "commercial"
};

export type PropertyMarketKind =
  | "national"
  | "national_type"
  | "national_subtype"
  | "state"
  | "state_category"
  | "state_type"
  | "state_subtype"
  | "city_category"
  | "city_type"
  | "city_subtype"
  | "area_category"
  | "area_subtype";

export type PropertyMarketRoute = {
  kind: PropertyMarketKind;
  path: string;
  state?: string;
  stateLabel?: string;
  city?: string;
  area?: string;
  areaSlug?: string;
  category?: ListingCategory;
  propertyType?: PropertyType;
  propertySubtype?: PropertySubtype;
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
  national_type: 1,
  national_subtype: 3,
  state: 3,
  state_category: 3,
  state_type: 3,
  state_subtype: 3,
  city_category: 5,
  city_type: 5,
  city_subtype: 8,
  area_category: 5,
  area_subtype: 8
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
  if (STATE_SLUG_ALIASES[normalized]) return STATE_SLUG_ALIASES[normalized];
  return NIGERIA_STATES.find((state) => getStateSlug(state) === normalized) ?? null;
}

export function resolveCitySlug(state: string, slug: string) {
  const normalized = slugifyMarketPart(slug);
  const alias = CITY_SLUG_ALIASES[normalized];
  const cities = getLgasForState(state);
  if (alias && cities.includes(alias)) return alias;
  return cities.find((city) => slugifyMarketPart(city) === normalized) ?? null;
}

export function getCategorySegment(category: ListingCategory) {
  return Object.entries(PROPERTY_CATEGORY_SEGMENTS).find(([, value]) => value === category)?.[0] ?? "";
}

export function getPropertyTypeSegment(propertyType: PropertyType) {
  return PROPERTY_TYPE_SEGMENTS[propertyType];
}

export function resolvePropertyTypeSegment(segment: string) {
  return PROPERTY_TYPE_ROUTE_ALIASES[slugifyMarketPart(segment)] ?? null;
}

export function buildPropertyMarketPath(input: {
  state?: string;
  city?: string;
  area?: string;
  areaSlug?: string;
  category?: ListingCategory;
  propertyType?: PropertyType;
  propertySubtype?: PropertySubtype;
}) {
  const parts = ["/properties"];
  if (input.category) parts.push(getCategorySegment(input.category));
  if (input.state) parts.push(getStateSlug(input.state));
  if (input.city) parts.push(slugifyMarketPart(input.city));
  if (input.areaSlug || input.area) parts.push(input.areaSlug ?? slugifyMarketPart(input.area ?? ""));
  if (input.propertySubtype) parts.push(getPropertySubtypeSegment(input.propertySubtype));
  else if (input.propertyType) parts.push(getPropertyTypeSegment(input.propertyType));
  return parts.join("/");
}

function withCanonicalPath(route: Omit<PropertyMarketRoute, "path">): PropertyMarketRoute {
  return {
    ...route,
    path: buildPropertyMarketPath(route)
  };
}

export function parsePropertyMarketSegments(segments: string[] = []): PropertyMarketRoute | null {
  const normalized = segments.map(slugifyMarketPart).filter(Boolean);
  if (!normalized.length) return { kind: "national", path: "/properties" };

  const category = PROPERTY_CATEGORY_SEGMENTS[normalized[0] as keyof typeof PROPERTY_CATEGORY_SEGMENTS];
  if (!category) {
    if (normalized.length !== 1) return null;
    const state = resolveStateSlug(normalized[0]);
    return state
      ? withCanonicalPath({ kind: "state", state, stateLabel: getPublicStateLabel(state) })
      : null;
  }

  if (normalized.length === 1) return withCanonicalPath({ kind: "national", category });

  const nationalType = resolvePropertyTypeSegment(normalized[1]);
  const nationalSubtype = resolvePropertySubtypeSegment(normalized[1]);
  if (normalized.length === 2 && nationalSubtype) {
    return withCanonicalPath({ kind: "national_subtype", category, propertySubtype: nationalSubtype });
  }
  if (normalized.length === 2 && nationalType) {
    return withCanonicalPath({ kind: "national_type", category, propertyType: nationalType });
  }

  const state = resolveStateSlug(normalized[1]);
  if (!state) return null;
  const stateBase = { category, state, stateLabel: getPublicStateLabel(state) };
  if (normalized.length === 2) return withCanonicalPath({ ...stateBase, kind: "state_category" });

  const stateType = resolvePropertyTypeSegment(normalized[2]);
  const stateSubtype = resolvePropertySubtypeSegment(normalized[2]);
  if (normalized.length === 3 && stateSubtype) {
    return withCanonicalPath({ ...stateBase, kind: "state_subtype", propertySubtype: stateSubtype });
  }
  if (normalized.length === 3 && stateType) {
    return withCanonicalPath({ ...stateBase, kind: "state_type", propertyType: stateType });
  }

  const city = resolveCitySlug(state, normalized[2]);
  if (!city) return null;
  const cityBase = { ...stateBase, city };
  if (normalized.length === 3) return withCanonicalPath({ ...cityBase, kind: "city_category" });

  const cityType = resolvePropertyTypeSegment(normalized[3]);
  const citySubtype = resolvePropertySubtypeSegment(normalized[3]);
  if (normalized.length === 4 && citySubtype) {
    return withCanonicalPath({ ...cityBase, kind: "city_subtype", propertySubtype: citySubtype });
  }
  if (normalized.length === 4 && cityType) {
    return withCanonicalPath({ ...cityBase, kind: "city_type", propertyType: cityType });
  }

  if (normalized.length === 4) {
    return withCanonicalPath({ ...cityBase, kind: "area_category", areaSlug: normalized[3] });
  }

  if (normalized.length !== 5) return null;
  const areaSubtype = resolvePropertySubtypeSegment(normalized[4]);
  if (!areaSubtype) return null;
  return withCanonicalPath({
    ...cityBase,
    kind: "area_subtype",
    areaSlug: normalized[3],
    propertySubtype: areaSubtype
  });
}

function pluralizeLabel(value: string) {
  const lower = value.toLowerCase();
  if (lower.endsWith("land") || lower.endsWith("quarters") || lower.endsWith("flats")) return value;
  if (lower.endsWith("property")) return `${value.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(value)) return `${value}es`;
  if (/[^aeiou]y$/i.test(value)) return `${value.slice(0, -1)}ies`;
  return `${value}s`;
}

function getPropertyLabel(route: PropertyMarketRoute) {
  if (route.propertySubtype) return pluralizeLabel(PROPERTY_SUBTYPE_LABELS[route.propertySubtype]);
  if (route.propertyType) return PROPERTY_TYPE_LABELS[route.propertyType];
  return "Properties";
}

function buildMarketTitle(route: PropertyMarketRoute, compactArea = false) {
  if (!route.category && !route.state) return "Property listings across Nigeria";
  if (!route.category && route.stateLabel) return `Property listings in ${route.stateLabel}`;

  const category = route.category ? CATEGORY_LABELS[route.category] : "";
  const areaName = route.area ?? route.areaSlug?.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  const location = route.areaSlug
    ? ` in ${[areaName, compactArea ? null : route.city, route.stateLabel].filter(Boolean).join(", ")}`
    : route.city
      ? ` in ${route.city}, ${route.stateLabel}`
      : route.stateLabel
        ? ` in ${route.stateLabel}`
        : " in Nigeria";
  return `${getPropertyLabel(route)} ${category}${location}`.replace(/\s+/g, " ").trim();
}

export function getMarketTitle(route: PropertyMarketRoute) {
  return buildMarketTitle(route);
}

export function getMarketSeoTitle(route: PropertyMarketRoute, listingCount: number) {
  return `${buildMarketTitle(route, true)} (${listingCount} available) | C59 Estatehub`;
}

export function getMarketDescription(route: PropertyMarketRoute, listingCount: number) {
  const count = listingCount === 1 ? "1 verified property" : `${listingCount} verified properties`;
  return `Browse ${count}: ${getMarketTitle(route).toLowerCase()}. Contact approved agents on C59 Estatehub.`;
}

export function getMarketIndexability(route: PropertyMarketRoute, stats: PropertyMarketStats, now = new Date()) {
  const threshold = MARKET_INDEX_THRESHOLDS[route.kind];
  const latest = stats.latestUpdatedAt ? new Date(stats.latestUpdatedAt) : null;
  const recencyCutoff = new Date(now.getTime() - MARKET_RECENCY_DAYS * 24 * 60 * 60 * 1000);
  const isRecent = Boolean(latest && !Number.isNaN(latest.getTime()) && latest >= recencyCutoff);
  const hasInventory = stats.listingCount >= threshold;
  const hasAcceptableDiversity = stats.listingCount < 3 || stats.duplicateRatio <= 0.7;
  if (!hasInventory) return { eligible: false, threshold, reason: `Needs at least ${threshold} active listings.` };
  if (!isRecent) return { eligible: false, threshold, reason: "Needs a listing updated within the last 60 days." };
  if (!hasAcceptableDiversity) return { eligible: false, threshold, reason: "Needs more distinct listing content." };
  return { eligible: true, threshold, reason: "Inventory, freshness, and diversity requirements are met." };
}

export function getLegacyPropertyRedirect(params: Record<string, string | string[] | undefined>) {
  const values = Object.fromEntries(
    Object.entries(params).filter(([, value]) => typeof value === "string" && value.trim())
  ) as Record<string, string>;
  const allowed = new Set(["state", "city", "listingCategory", "propertyType", "propertySubtype"]);
  if (!Object.keys(values).length || Object.keys(values).some((key) => !allowed.has(key))) return null;

  const normalizedState = values.state ? normalizeNigeriaState(values.state) : undefined;
  const state = normalizedState && NIGERIA_STATES.includes(normalizedState) ? normalizedState : undefined;
  const city = state && values.city && getLgasForState(state).includes(values.city) ? values.city : undefined;
  const category = Object.values(PROPERTY_CATEGORY_SEGMENTS).includes(values.listingCategory as ListingCategory)
    ? (values.listingCategory as ListingCategory)
    : undefined;
  const propertyType = values.propertyType ? resolvePropertyTypeSegment(values.propertyType) ?? undefined : undefined;
  const propertySubtype = values.propertySubtype ? resolvePropertySubtypeSegment(values.propertySubtype) : undefined;

  if (values.state && !state) return null;
  if (values.city && !city) return null;
  if (values.listingCategory && !category) return null;
  if (values.propertyType && !propertyType) return null;
  if (values.propertySubtype && !propertySubtype) return null;
  if (!state && city) return null;
  if (!state && !category) return null;
  if ((propertyType || propertySubtype) && !category) return null;
  return buildPropertyMarketPath({ state, city, category, propertyType, propertySubtype: propertySubtype ?? undefined });
}
