import type { ListingCategory, LocationValue } from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LISTING_SLUG_LENGTH = 120;

const categorySlugText: Record<ListingCategory, string> = {
  for_sale: "for sale",
  for_rent: "for rent",
  short_let: "short let"
};

export function isUuidListingIdentifier(value: string) {
  return UUID_PATTERN.test(value);
}

export function slugifyListingText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function trimSlug(value: string, maxLength = MAX_LISTING_SLUG_LENGTH) {
  return value.slice(0, maxLength).replace(/-+$/g, "") || "property-listing";
}

function uniqueLocationParts(location: Pick<LocationValue, "state" | "city" | "area">) {
  const seen = new Set<string>();
  return [location.area, location.city, location.state].filter((part) => {
    const normalized = slugifyListingText(part);
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

export function buildListingSlugBase(input: {
  title: string;
  listingCategory: ListingCategory;
  location: Pick<LocationValue, "state" | "city" | "area">;
}) {
  const titleSlug = slugifyListingText(input.title);
  const categoryText = categorySlugText[input.listingCategory];
  const categorySlug = slugifyListingText(categoryText);
  const base = slugifyListingText(
    [
      input.title,
      titleSlug.includes(categorySlug) ? "" : categoryText,
      ...uniqueLocationParts(input.location)
    ].join(" ")
  );

  return trimSlug(base);
}

export function withListingSlugSuffix(base: string, suffix: number) {
  const suffixText = `-${suffix}`;
  return `${trimSlug(base, MAX_LISTING_SLUG_LENGTH - suffixText.length)}${suffixText}`;
}

export function getAvailableListingSlug(base: string, existingSlugs: Iterable<string>) {
  const existing = new Set(existingSlugs);
  if (!existing.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = withListingSlugSuffix(base, suffix);
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique listing slug.");
}
