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

export const LISTING_FEATURE_GROUPS = [
  {
    key: "amenities",
    title: "Amenities",
    helper: "Common comfort and lifestyle features inside or around the property.",
    customPlaceholder: "Type other amenities, separated by commas",
    options: [
      "Air Conditioning",
      "Balcony",
      "Chandelier",
      "Dining Area",
      "POP Ceiling",
      "Kitchen Cabinets",
      "Kitchen Shelf",
      "Wardrobe",
      "Swimming Pool",
      "Gym",
      "Elevator"
    ]
  },
  {
    key: "utilities",
    title: "Utilities and appliances",
    helper: "Power, water, internet, and appliances available with the property.",
    customPlaceholder: "Type other utilities or appliances, separated by commas",
    options: [
      "24-hour Electricity",
      "Generator",
      "Pre-Paid Meter",
      "Water Supply",
      "Borehole",
      "Hot Water",
      "Internet",
      "Refrigerator",
      "Microwave",
      "Dishwasher"
    ]
  },
  {
    key: "safetyFeatures",
    title: "Safety",
    helper: "Security and safety features that help buyers or renters trust the listing.",
    customPlaceholder: "Type other safety features, separated by commas",
    options: ["CCTV Cameras", "Security Post", "Gated Estate", "Smoke Detector", "Fire Extinguisher"]
  },
  {
    key: "nearbyLandmarks",
    title: "Nearby landmarks",
    helper: "Useful places near the property that help people understand the location.",
    customPlaceholder: "Type other nearby landmarks, separated by commas",
    options: ["School", "Hospital", "Market", "Shopping Mall", "Main Road", "Bus Stop", "Airport"]
  },
  {
    key: "extraFeatures",
    title: "Extra features",
    helper: "Other details that make the property easier to compare.",
    customPlaceholder: "Type other extra features, separated by commas",
    options: ["Self Contained", "Boys Quarters", "Study Room", "Store", "Laundry Room", "Pet Friendly"]
  }
] as const;

export type ListingFeatureGroupKey = (typeof LISTING_FEATURE_GROUPS)[number]["key"];

export function normalizeListingFeatureLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseListingFeatureText(value: string) {
  return value
    .split(/[,\n]/g)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

export function mergeListingFeatureValues(selectedValues: string[], customText: string) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of [...selectedValues, ...parseListingFeatureText(customText)]) {
    const cleanValue = value.trim().replace(/\s+/g, " ");
    const normalizedValue = normalizeListingFeatureLabel(cleanValue);

    if (!cleanValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    merged.push(cleanValue);
  }

  return merged;
}

export function splitListingFeatureValues(values: string[], options: readonly string[]) {
  const optionByNormalizedValue = new Map(options.map((option) => [normalizeListingFeatureLabel(option), option]));
  const selected: string[] = [];
  const custom: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalizedValue = normalizeListingFeatureLabel(value);

    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    const knownOption = optionByNormalizedValue.get(normalizedValue);

    if (knownOption) {
      selected.push(knownOption);
    } else {
      custom.push(value.trim().replace(/\s+/g, " "));
    }
  }

  return {
    selected,
    customText: custom.join(", ")
  };
}

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
