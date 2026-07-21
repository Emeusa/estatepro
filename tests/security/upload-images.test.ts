import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getListingImageCountLimitMessage,
  getListingImageFormatErrorMessage,
  isPhoneHighEfficiencyListingImageFile,
  isRawListingImageFile,
  isSupportedListingImageFile,
  LISTING_GALLERY_PICKER_ACCEPT,
  LISTING_PHONE_GALLERY_ACCEPT,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGES,
  MAX_LISTING_ORIGINAL_IMAGE_BYTES,
  PHONE_HIGH_EFFICIENCY_IMAGE_MESSAGE,
  normalizeListingImageType
} from "../../src/lib/image-limits";
import { getListingImageUploadBlockReason } from "../../src/lib/upload-permissions";

describe("listing image mobile file handling", () => {
  it("does not rate-limit listing image upload endpoints", () => {
    const routes = [
      "src/app/api/uploads/listing-images/authorize/route.ts",
      "src/app/api/uploads/listing-images/fallback/route.ts"
    ];

    for (const routePath of routes) {
      const source = readFileSync(path.join(process.cwd(), routePath), "utf8");
      expect(source).not.toContain("RATE_LIMITS.imageUpload");
      expect(source).not.toContain("rateLimit(request");
      expect(source).not.toContain("withRateLimitHeaders");
    }

    const rateLimitSource = readFileSync(path.join(process.cwd(), "src/lib/security/rate-limit.ts"), "utf8");
    expect(rateLimitSource).not.toContain("imageUpload");
  });

  it("uses a phone gallery picker with a native file fallback and simple thumbnail selector", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/listing-form.tsx"), "utf8");

    expect(source).toContain('name="images"');
    expect(source).toContain('type="file"');
    expect(source).toContain("multiple");
    expect(source).toContain("accept={LISTING_PHONE_GALLERY_ACCEPT}");
    expect(source).toContain("accept={LISTING_GALLERY_PICKER_ACCEPT}");
    expect(source).toContain('className="input"');
    expect(source).toContain("Select photos from gallery");
    expect(source).toContain("If some albums do not show");
    expect(source).toContain("Choose photos from your gallery.");
    expect(source).toContain("photos selected");
    expect(source).toContain("Choose upload thumbnail");
    expect(source).toContain("Thumbnail selected");
    expect(source).not.toContain("Review selected photos");
    expect(source).not.toContain("Clear all");
    expect(source).not.toContain("Remove");
    expect(source).not.toContain("formatImageSize");
  });

  it("keeps the picker accept simple for reliable gallery behavior", () => {
    expect(LISTING_PHONE_GALLERY_ACCEPT).toBe("image/*");
    expect(LISTING_GALLERY_PICKER_ACCEPT).toBe("image/jpeg,image/png,image/webp,.jpg,.jpeg,.jpe,.jfif,.png,.webp");
    expect(isSupportedListingImageFile({ name: "ios-photo.heic", type: "image/heic" })).toBe(false);
    expect(isSupportedListingImageFile({ name: "android-photo.avif", type: "image/avif" })).toBe(false);
  });

  it("accepts Android-style JPG metadata", () => {
    expect(normalizeListingImageType({ name: "kitchen.jpg", type: "image/jpeg" })).toBe("image/jpeg");
    expect(isSupportedListingImageFile({ name: "kitchen.jpg", type: "image/jpeg" })).toBe(true);
  });

  it("accepts JPG and PNG mobile MIME aliases", () => {
    expect(normalizeListingImageType({ name: "front-door.jpg", type: "image/jpg" })).toBe("image/jpeg");
    expect(normalizeListingImageType({ name: "front-door.jfif", type: "image/pjpeg" })).toBe("image/jpeg");
    expect(normalizeListingImageType({ name: "floor-plan.png", type: "image/x-png" })).toBe("image/png");
  });

  it("accepts uppercase extensions and blank mobile MIME values for active formats", () => {
    expect(normalizeListingImageType({ name: "Living-Room.JPG", type: "" })).toBe("image/jpeg");
    expect(normalizeListingImageType({ name: "compound.PNG", type: "" })).toBe("image/png");
    expect(normalizeListingImageType({ name: "bedroom.WEBP", type: "" })).toBe("image/webp");
  });

  it("gives iPhone guidance for HEIC, HEIF, and AVIF instead of server conversion", () => {
    expect(isPhoneHighEfficiencyListingImageFile({ name: "ios-photo.heic", type: "image/heic" })).toBe(true);
    expect(isPhoneHighEfficiencyListingImageFile({ name: "ios-photo.heif", type: "image/heif" })).toBe(true);
    expect(isPhoneHighEfficiencyListingImageFile({ name: "android-photo.avif", type: "image/avif" })).toBe(true);
    expect(getListingImageFormatErrorMessage({ name: "ios-photo.heic", type: "image/heic" })).toBe(
      PHONE_HIGH_EFFICIENCY_IMAGE_MESSAGE
    );
  });

  it("rejects RAW, DNG, and unsupported formats", () => {
    expect(isRawListingImageFile({ name: "ios-photo.DNG", type: "image/x-adobe-dng" })).toBe(true);
    expect(getListingImageFormatErrorMessage({ name: "ios-photo.DNG", type: "image/x-adobe-dng" })).toMatch(/raw/i);
    expect(normalizeListingImageType({ name: "document.pdf", type: "application/pdf" })).toBeNull();
    expect(isSupportedListingImageFile({ name: "image.gif", type: "image/gif" })).toBe(false);
  });

  it("uses twenty megabytes as the original input size limit", () => {
    expect(MAX_LISTING_IMAGE_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_LISTING_ORIGINAL_IMAGE_BYTES).toBe(20 * 1024 * 1024);
  });

  it("allows fifteen images and rejects sixteen with a clear limit message", () => {
    expect(MAX_LISTING_IMAGES).toBe(15);
    expect(getListingImageCountLimitMessage(15)).toBeNull();
    expect(getListingImageCountLimitMessage(16)).toBe(
      "You can upload up to 15 images per listing. Remove 1 image and try again."
    );
  });

  it("keeps the Supabase image variants constraint aligned with fifteen images", () => {
    const schema = readFileSync(path.join(process.cwd(), "docs/supabase-schema.sql"), "utf8");

    expect(schema).toContain("drop constraint if exists listings_image_variants_check");
    expect(schema).toContain("jsonb_array_length(image_variants) <= 15");
    expect(schema).not.toContain("jsonb_array_length(image_variants) <= 10");
  });
});

describe("listing image fallback upload permissions", () => {
  it("allows pending and approved unblocked agents", () => {
    expect(getListingImageUploadBlockReason({ verification_status: "pending", is_blocked: false })).toBeNull();
    expect(getListingImageUploadBlockReason({ verification_status: "approved", is_blocked: false })).toBeNull();
  });

  it("denies rejected, blocked, and missing agent profiles", () => {
    expect(getListingImageUploadBlockReason({ verification_status: "rejected", is_blocked: false })).toMatch(/rejected/);
    expect(getListingImageUploadBlockReason({ verification_status: "approved", is_blocked: true })).toMatch(/blocked/);
    expect(getListingImageUploadBlockReason(null)).toMatch(/not found/);
  });
});
