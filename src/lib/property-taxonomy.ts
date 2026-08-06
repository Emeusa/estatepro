import type { LegacyPropertyType, PropertySubtype, PropertyType } from "@/lib/types";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartments",
  house: "Houses",
  room: "Rooms",
  land: "Land",
  commercial: "Commercial property"
};

export const PROPERTY_TYPE_SEGMENTS: Record<PropertyType, string> = {
  apartment: "apartments",
  house: "houses",
  room: "rooms",
  land: "land",
  commercial: "commercial"
};

export const PROPERTY_SUBTYPES: Record<PropertyType, readonly PropertySubtype[]> = {
  apartment: [
    "flat_apartment", "mini_flat", "self_contain", "studio_apartment", "shared_apartment",
    "serviced_apartment", "maisonette", "penthouse", "block_of_flats"
  ],
  house: [
    "duplex", "detached_duplex", "semi_detached_duplex", "terraced_duplex", "bungalow",
    "detached_bungalow", "semi_detached_bungalow", "terraced_bungalow", "terrace_house",
    "townhouse", "mansion", "villa"
  ],
  room: ["single_room", "room_and_parlour", "boys_quarters", "shared_room"],
  land: [
    "residential_land", "commercial_land", "industrial_land", "mixed_use_land", "agricultural_land",
    "joint_venture_land", "waterfront_land", "estate_plot", "other_land"
  ],
  commercial: [
    "office", "private_office", "coworking_space", "workstation", "conference_room", "shop",
    "showroom", "plaza_mall_complex", "warehouse", "factory", "filling_station", "event_hall",
    "hotel", "guest_house", "resort", "restaurant_bar", "school", "hospital_clinic",
    "religious_property", "commercial_building", "other_commercial"
  ]
};

export const PROPERTY_SUBTYPE_LABELS: Record<PropertySubtype, string> = {
  flat_apartment: "Flat / apartment",
  mini_flat: "Mini flat",
  self_contain: "Self contain",
  studio_apartment: "Studio apartment",
  shared_apartment: "Shared apartment",
  serviced_apartment: "Serviced apartment",
  maisonette: "Maisonette",
  penthouse: "Penthouse",
  block_of_flats: "Block of flats",
  duplex: "Duplex",
  detached_duplex: "Detached duplex",
  semi_detached_duplex: "Semi-detached duplex",
  terraced_duplex: "Terraced duplex",
  bungalow: "Bungalow",
  detached_bungalow: "Detached bungalow",
  semi_detached_bungalow: "Semi-detached bungalow",
  terraced_bungalow: "Terraced bungalow",
  terrace_house: "Terrace house",
  townhouse: "Townhouse",
  mansion: "Mansion",
  villa: "Villa",
  single_room: "Single room",
  room_and_parlour: "Room and parlour",
  boys_quarters: "Boys' quarters",
  shared_room: "Shared room",
  residential_land: "Residential land",
  commercial_land: "Commercial land",
  industrial_land: "Industrial land",
  mixed_use_land: "Mixed-use land",
  agricultural_land: "Agricultural / farm land",
  joint_venture_land: "Joint-venture land",
  waterfront_land: "Waterfront land",
  estate_plot: "Estate plot",
  other_land: "Other land",
  office: "Office",
  private_office: "Private office",
  coworking_space: "Coworking space",
  workstation: "Workstation",
  conference_room: "Conference room",
  shop: "Shop",
  showroom: "Showroom",
  plaza_mall_complex: "Plaza / mall / complex",
  warehouse: "Warehouse",
  factory: "Factory",
  filling_station: "Filling station",
  event_hall: "Event hall",
  hotel: "Hotel",
  guest_house: "Guest house",
  resort: "Resort",
  restaurant_bar: "Restaurant / bar",
  school: "School",
  hospital_clinic: "Hospital / clinic",
  religious_property: "Religious property",
  commercial_building: "Commercial building",
  other_commercial: "Other commercial property"
};

function pluralizeSegment(value: string) {
  if (value.endsWith("land") || value.endsWith("quarters") || value.endsWith("flats")) return value;
  if (value.endsWith("property")) return `${value.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(value)) return `${value}es`;
  if (/[^aeiou]y$/.test(value)) return `${value.slice(0, -1)}ies`;
  return `${value}s`;
}

const subtypeSegments = Object.fromEntries(
  Object.keys(PROPERTY_SUBTYPE_LABELS).map((subtype) => {
    const segment = subtype.replace(/_/g, "-");
    return [pluralizeSegment(segment), subtype];
  })
) as Record<string, PropertySubtype>;

export const PROPERTY_SUBTYPE_SEGMENTS: Record<string, PropertySubtype> = {
  ...subtypeSegments,
  "flats-apartments": "flat_apartment",
  flats: "flat_apartment",
  "mini-flat": "mini_flat",
  miniflat: "mini_flat",
  "mini-flats": "mini_flat",
  "room-and-parlour": "room_and_parlour",
  "self-contained": "self_contain",
  "self-contain": "self_contain",
  "self-contains": "self_contain",
  terrace: "terraced_duplex",
  "terraced-duplex": "terraced_duplex",
  "terraced-duplexes": "terraced_duplex"
};

export const LEGACY_PROPERTY_TYPE_ALIASES: Record<LegacyPropertyType, PropertyType> = {
  duplex: "house",
  office: "commercial",
  shop: "commercial"
};

export function normalizePropertyType(value: string | null | undefined): PropertyType {
  if (value === "apartment" || value === "house" || value === "room" || value === "land" || value === "commercial") {
    return value;
  }
  return LEGACY_PROPERTY_TYPE_ALIASES[value as LegacyPropertyType] ?? "apartment";
}

export function getPropertyTypeStorageValues(value: PropertyType) {
  if (value === "house") return ["house", "duplex"];
  if (value === "commercial") return ["commercial", "office", "shop"];
  return [value];
}

export function isPropertySubtype(value: string): value is PropertySubtype {
  return Object.prototype.hasOwnProperty.call(PROPERTY_SUBTYPE_LABELS, value);
}

export function isSubtypeForPropertyType(propertyType: PropertyType, subtype: PropertySubtype) {
  return PROPERTY_SUBTYPES[propertyType].includes(subtype);
}

export function getPropertySubtypeType(subtype: PropertySubtype) {
  return (Object.entries(PROPERTY_SUBTYPES) as Array<[PropertyType, readonly PropertySubtype[]]>)
    .find(([, subtypes]) => subtypes.includes(subtype))?.[0] ?? null;
}

export function getPropertySubtypeSegment(subtype: PropertySubtype) {
  const preferred = Object.entries(PROPERTY_SUBTYPE_SEGMENTS).find(([, value]) => value === subtype)?.[0];
  return preferred ?? subtype.replace(/_/g, "-");
}

export function resolvePropertySubtypeSegment(segment: string) {
  return PROPERTY_SUBTYPE_SEGMENTS[segment.toLowerCase()] ?? null;
}

export function getLegacySubtypeForPropertyType(value: string | null | undefined): PropertySubtype | null {
  if (value === "office") return "office";
  if (value === "shop") return "shop";
  if (value === "duplex") return "duplex";
  return null;
}
