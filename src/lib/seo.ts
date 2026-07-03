import { ListingCategory, ListingRecord } from "@/lib/types";

export const SITE_NAME = "C59 Estatehub";
export const PRODUCTION_SITE_URL = "https://c59estatehub.com";
export const DEFAULT_SITE_DESCRIPTION =
  "Find verified homes, land, rentals, and commercial properties in Nigeria.";

const listingCategoryPhrases: Record<ListingCategory, string> = {
  for_sale: "for Sale",
  for_rent: "for Rent",
  short_let: "for Short Let"
};

export function getSiteUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!rawUrl) {
    if (process.env.NODE_ENV === "production") {
      return new URL(PRODUCTION_SITE_URL);
    }
    return new URL("http://localhost:3000");
  }

  try {
    return new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function getListingCategoryPhrase(category: ListingCategory) {
  return listingCategoryPhrases[category];
}

export function formatListingLocation(listing: ListingRecord) {
  return [listing.location.area, listing.location.city, listing.location.state].filter(Boolean).join(", ");
}

export function trimMetaDescription(value: string, maxLength = 155) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function buildListingMetaTitle(listing: ListingRecord) {
  const titleLower = listing.title.toLowerCase();
  const stateLower = listing.location.state.toLowerCase();
  const hasCategory = /\bfor rent\b|\bfor sale\b|\bshort let\b/.test(titleLower);
  const hasState = stateLower ? titleLower.includes(stateLower) : false;
  const titleWithCategory = hasCategory
    ? listing.title
    : `${listing.title} ${getListingCategoryPhrase(listing.listingCategory)}`;

  return `${titleWithCategory}${hasState ? "" : ` in ${listing.location.state}`} | ${SITE_NAME}`;
}

export function buildListingMetaDescription(listing: ListingRecord) {
  return trimMetaDescription(
    `View ${listing.title} in ${formatListingLocation(listing)}. Contact a verified agent on ${SITE_NAME}.`
  );
}
