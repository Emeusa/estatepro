import { describe, expect, it } from "vitest";

import { listingInputSchema } from "../../src/modules/listings/listing.schema";

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
});
