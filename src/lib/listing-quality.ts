import { ListingRecord } from "@/lib/types";

export const PROPERTY_SIZE_UNITS = ["sqm", "sqft"] as const;
export const LAND_SIZE_UNITS = ["sqm", "plots", "acres", "hectares"] as const;
export const FURNISHING_STATUSES = ["unfurnished", "semi_furnished", "furnished"] as const;
export const SERVICING_STATUSES = ["unserviced", "partly_serviced", "serviced"] as const;
export const PROPERTY_CONDITIONS = ["newly_built", "renovated", "fairly_used", "needs_renovation"] as const;
export const TITLE_DOCUMENT_TYPES = [
  "certificate_of_occupancy",
  "governors_consent",
  "registered_survey",
  "deed_of_assignment",
  "excision",
  "gazette",
  "receipt",
  "other"
] as const;
export const ZONING_TYPES = ["residential", "commercial", "mixed_use", "industrial", "agricultural"] as const;
export const ROAD_ACCESS_TYPES = ["tarred", "untarred", "estate_road", "major_road", "none"] as const;

export const PROPERTY_SIZE_UNIT_LABELS = {
  sqm: "sqm",
  sqft: "sq ft"
} as const;

export const LAND_SIZE_UNIT_LABELS = {
  sqm: "sqm",
  plots: "plots",
  acres: "acres",
  hectares: "hectares"
} as const;

export const FURNISHING_STATUS_LABELS = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi furnished",
  furnished: "Furnished"
} as const;

export const SERVICING_STATUS_LABELS = {
  unserviced: "Unserviced",
  partly_serviced: "Partly serviced",
  serviced: "Serviced"
} as const;

export const PROPERTY_CONDITION_LABELS = {
  newly_built: "Newly built",
  renovated: "Renovated",
  fairly_used: "Fairly used",
  needs_renovation: "Needs renovation"
} as const;

export const TITLE_DOCUMENT_TYPE_LABELS = {
  certificate_of_occupancy: "Certificate of Occupancy",
  governors_consent: "Governor's Consent",
  registered_survey: "Registered Survey",
  deed_of_assignment: "Deed of Assignment",
  excision: "Excision",
  gazette: "Gazette",
  receipt: "Receipt",
  other: "Other"
} as const;

export const ZONING_TYPE_LABELS = {
  residential: "Residential",
  commercial: "Commercial",
  mixed_use: "Mixed use",
  industrial: "Industrial",
  agricultural: "Agricultural"
} as const;

export const ROAD_ACCESS_LABELS = {
  tarred: "Tarred road",
  untarred: "Untarred road",
  estate_road: "Estate road",
  major_road: "Major road",
  none: "No direct road access"
} as const;

export function formatCount(value: number | null, singular: string, plural: string) {
  if (!value) {
    return null;
  }
  return `${value} ${value === 1 ? singular : plural}`;
}

export function formatSize(value: number | null, unit: string | null, labels: Record<string, string>) {
  if (!value || !unit) {
    return null;
  }
  return `${value.toLocaleString()} ${labels[unit] ?? unit}`;
}

export function getListingQualityBadges(listing: ListingRecord) {
  return [
    formatCount(listing.bedrooms, "Bed", "Beds"),
    formatCount(listing.bathrooms, "Bath", "Baths"),
    formatCount(listing.toilets, "Toilet", "Toilets"),
    formatCount(listing.parkingSpaces, "Parking", "Parking"),
    formatSize(listing.propertySize, listing.propertySizeUnit, PROPERTY_SIZE_UNIT_LABELS),
    formatSize(listing.landSize, listing.landSizeUnit, LAND_SIZE_UNIT_LABELS)
  ].filter((value): value is string => Boolean(value));
}
