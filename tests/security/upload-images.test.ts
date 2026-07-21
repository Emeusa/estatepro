import { describe, expect, it } from "vitest";

import {
  getListingImageCountLimitMessage,
  isSupportedListingImageFile,
  isUnsupportedHeicImage,
  MAX_LISTING_IMAGES,
  MAX_LISTING_IMAGE_BYTES,
  normalizeListingImageType
} from "../../src/lib/image-limits";
import { getListingImageUploadBlockReason } from "../../src/lib/upload-permissions";

describe("listing image mobile file handling", () => {
  it("accepts Android-style JPG metadata", () => {
    expect(normalizeListingImageType({ name: "kitchen.jpg", type: "image/jpeg" })).toBe("image/jpeg");
    expect(isSupportedListingImageFile({ name: "kitchen.jpg", type: "image/jpeg" })).toBe(true);
  });

  it("accepts image/jpg and normalizes it to image/jpeg", () => {
    expect(normalizeListingImageType({ name: "front-door.jpg", type: "image/jpg" })).toBe("image/jpeg");
  });

  it("accepts uppercase extensions and blank mobile MIME values", () => {
    expect(normalizeListingImageType({ name: "Living-Room.JPG", type: "" })).toBe("image/jpeg");
    expect(normalizeListingImageType({ name: "compound.PNG", type: "" })).toBe("image/png");
    expect(normalizeListingImageType({ name: "bedroom.WEBP", type: "" })).toBe("image/webp");
  });

  it("rejects HEIC/HEIF and unsupported formats", () => {
    expect(isUnsupportedHeicImage({ name: "ios-photo.HEIC", type: "" })).toBe(true);
    expect(normalizeListingImageType({ name: "document.pdf", type: "application/pdf" })).toBeNull();
    expect(isSupportedListingImageFile({ name: "image.gif", type: "image/gif" })).toBe(false);
  });

  it("keeps the five megabyte size limit as the upload boundary", () => {
    expect(MAX_LISTING_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("returns a clear limit message when too many images are selected", () => {
    expect(getListingImageCountLimitMessage(15)).toBe(
      `You can upload up to ${MAX_LISTING_IMAGES} images per listing. Remove 5 images and try again.`
    );
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
