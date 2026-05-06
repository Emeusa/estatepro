import { ListingAvailability, ListingCategory, ListingRecord } from "@/lib/types";

export const LISTING_CATEGORY_LABELS: Record<ListingCategory, string> = {
  for_sale: "FOR SALE",
  for_rent: "FOR RENT",
  short_let: "SHORT LET"
};

export const AVAILABILITY_LABELS: Record<ListingAvailability, string> = {
  available: "Available",
  sold: "Sold",
  rented: "Rented",
  booked: "Booked"
};

export const CATEGORY_AVAILABILITY: Record<ListingCategory, ListingAvailability[]> = {
  for_sale: ["available", "sold"],
  for_rent: ["available", "rented"],
  short_let: ["available", "booked"]
};

export function getUnavailableBadge(listing: ListingRecord) {
  if (listing.availability === "available") {
    return null;
  }

  return AVAILABILITY_LABELS[listing.availability].toUpperCase();
}
