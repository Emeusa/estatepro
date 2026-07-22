import { describe, expect, it } from "vitest";

import { MAX_LISTING_IMAGES } from "../../src/lib/image-limits";
import { mapListingErrors, mapListingRuntimeError } from "../../src/modules/listings/listing-error-mapper";
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

function validVariant(extension: "webp" | "jpg" | "jpeg" = "webp", blurType: "webp" | "jpeg" = "webp") {
  return {
    heroUrl: `https://example.supabase.co/storage/v1/object/public/listing-images/user/photo-hero.${extension}`,
    cardUrl: `https://example.supabase.co/storage/v1/object/public/listing-images/user/photo-card.${extension}`,
    blurDataUrl: `data:image/${blurType};base64,abc`,
    width: 900,
    height: 900,
    cardWidth: 450,
    cardHeight: 450,
    order: 0
  };
}

describe("listingInputSchema", () => {
  it("rejects unexpected fields", () => {
    const result = listingInputSchema.safeParse({ ...validListing, unknown: true });
    expect(result.success).toBe(false);
  });

  it("maps too many listing images to a clear image limit message", () => {
    const result = listingInputSchema.safeParse({
      ...validListing,
      imageUrls: Array.from(
        { length: 16 },
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
      expect(mapListingErrors(result.error).images).not.toMatch(/5 MB/i);
    }
  });

  it("accepts JPEG fallback optimized variants from Safari uploads", () => {
    const result = listingInputSchema.safeParse({
      ...validListing,
      imageUrls: ["https://example.supabase.co/storage/v1/object/public/listing-images/user/photo-hero.jpg"],
      imageVariants: [validVariant("jpg", "jpeg")]
    });

    expect(result.success).toBe(true);
  });

  it("accepts JPEG extension variants and WebP variants from platform storage only", () => {
    expect(
      listingInputSchema.safeParse({
        ...validListing,
        imageUrls: ["https://example.supabase.co/storage/v1/object/public/listing-images/user/photo-hero.jpeg"],
        imageVariants: [validVariant("jpeg", "webp")]
      }).success
    ).toBe(true);

    const externalResult = listingInputSchema.safeParse({
      ...validListing,
      imageVariants: [
        {
          ...validVariant("jpg", "jpeg"),
          heroUrl: "https://example.com/listing-images/photo-hero.jpg"
        }
      ]
    });
    expect(externalResult.success).toBe(false);

    const unsupportedResult = listingInputSchema.safeParse({
      ...validListing,
      imageVariants: [
        {
          ...validVariant("jpg", "jpeg"),
          cardUrl: "https://example.supabase.co/storage/v1/object/public/listing-images/user/photo-card.gif"
        }
      ]
    });
    expect(unsupportedResult.success).toBe(false);
  });

  it("maps the old database image-variant constraint to a setup message", () => {
    const mapped = mapListingRuntimeError(
      new Error('new row for relation "listings" violates check constraint "listings_image_variants_check"')
    );

    expect(mapped?.message).toMatch(/database image limit is not updated/i);
    expect(mapped?.fields.images).toMatch(/15 images/i);
  });
});
