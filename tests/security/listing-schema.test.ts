import { describe, expect, it } from "vitest";

import { MAX_LISTING_IMAGES } from "../../src/lib/image-limits";
import { mapListingErrors } from "../../src/modules/listings/listing-error-mapper";
import { listingInputSchema } from "../../src/modules/listings/listing.schema";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

const validListing = {
  title: "tree bedroom apartmemts in lagos",
  description: "A clean and spacious apartment suitable for family living.",
  price: 2000000,
  propertyType: "apartment",
  listingCategory: "for_rent",
  availability: "available",
  imageUrls: ["https://example.supabase.co/storage/v1/object/public/listing-images/user/photo.jpg"],
  contactPhone: "08031234567",
  contactWhatsapp: "08031234567",
  location: {
    state: "Lagos",
    city: "Ikeja",
    area: "Allen Avenue"
  }
};

describe("listingInputSchema", () => {
  it("rejects unexpected fields", () => {
    const result = listingInputSchema.safeParse({ ...validListing, unknown: true });
    expect(result.success).toBe(false);
  });

  it("maps too many listing images to a clear image limit message", () => {
    const result = listingInputSchema.safeParse({
      ...validListing,
      imageUrls: Array.from(
        { length: 15 },
        (_, index) => `https://example.supabase.co/storage/v1/object/public/listing-images/user/photo-${index}.jpg`
      )
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(mapListingErrors(result.error).images).toBe(
        `You can upload up to ${MAX_LISTING_IMAGES} images per listing. Remove extra images and try again.`
      );
    }
  });

  it("maps unverified image URLs to a user-actionable upload message", () => {
    const result = listingInputSchema.safeParse({
      ...validListing,
      imageUrls: ["https://example.com/photo.jpg"]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(mapListingErrors(result.error).images).toMatch(/could not be verified/i);
    }
  });
});
