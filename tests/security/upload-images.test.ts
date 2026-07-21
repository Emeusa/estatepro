import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getListingImageFormatErrorMessage,
  getListingImageCountLimitMessage,
  isRawListingImageFile,
  isServerConvertedListingImageFile,
  isSupportedListingImageFile,
  MAX_LISTING_IMAGES,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_ORIGINAL_IMAGE_BYTES,
  normalizeListingImageType
} from "../../src/lib/image-limits";
import { getThumbnailIndexAfterImageRemoval, mergeListingImageSelection } from "../../src/lib/listing-image-selection";
import { getListingOriginalPathBlockReason } from "../../src/lib/listing-image-originals";
import { getListingImageUploadBlockReason } from "../../src/lib/upload-permissions";

describe("listing image mobile file handling", () => {
  it("uses a gallery-first picker plus strict file-browser fallback", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/listing-form.tsx"), "utf8");

    expect(source).toContain('accept="image/*"');
    expect(source).toContain("accept={SUPPORTED_LISTING_IMAGE_ACCEPT}");
    expect(source).toContain("Select photos from gallery");
    expect(source).toContain("Browse files");
    expect(source).toContain("Add more photos");
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

  it("accepts uppercase extensions and blank mobile MIME values", () => {
    expect(normalizeListingImageType({ name: "Living-Room.JPG", type: "" })).toBe("image/jpeg");
    expect(normalizeListingImageType({ name: "compound.PNG", type: "" })).toBe("image/png");
    expect(normalizeListingImageType({ name: "bedroom.WEBP", type: "" })).toBe("image/webp");
    expect(normalizeListingImageType({ name: "ios-photo.HEIC", type: "" })).toBe("image/heic");
    expect(normalizeListingImageType({ name: "ios-photo.HEIF", type: "" })).toBe("image/heif");
    expect(normalizeListingImageType({ name: "android-photo.AVIF", type: "" })).toBe("image/avif");
  });

  it("accepts HEIC, HEIF, and AVIF as server-converted formats", () => {
    expect(isSupportedListingImageFile({ name: "ios-photo.heic", type: "image/heic" })).toBe(true);
    expect(isSupportedListingImageFile({ name: "ios-photo.heif", type: "image/heif" })).toBe(true);
    expect(isSupportedListingImageFile({ name: "android-photo.avif", type: "image/avif" })).toBe(true);
    expect(isServerConvertedListingImageFile({ name: "ios-photo.heic", type: "image/heic", size: 3000000 })).toBe(true);
  });

  it("rejects RAW, DNG, and unsupported formats", () => {
    expect(isRawListingImageFile({ name: "ios-photo.DNG", type: "image/x-adobe-dng" })).toBe(true);
    expect(getListingImageFormatErrorMessage({ name: "ios-photo.DNG", type: "image/x-adobe-dng" })).toMatch(/raw/i);
    expect(normalizeListingImageType({ name: "document.pdf", type: "application/pdf" })).toBeNull();
    expect(isSupportedListingImageFile({ name: "image.gif", type: "image/gif" })).toBe(false);
  });

  it("keeps the fifteen megabyte original size limit as the upload boundary", () => {
    expect(MAX_LISTING_IMAGE_BYTES).toBe(15 * 1024 * 1024);
    expect(MAX_LISTING_ORIGINAL_IMAGE_BYTES).toBe(15 * 1024 * 1024);
  });

  it("returns a clear limit message when too many images are selected", () => {
    expect(getListingImageCountLimitMessage(15)).toBe(
      `You can upload up to ${MAX_LISTING_IMAGES} images per listing. Remove 5 images and try again.`
    );
  });

  it("appends gallery selections without replacing existing photos", () => {
    const existing = [{ name: "front.jpg", size: 100, lastModified: 1 }] as File[];
    const incoming = [
      { name: "room.jpg", size: 200, lastModified: 2 },
      { name: "kitchen.jpg", size: 300, lastModified: 3 }
    ] as File[];

    const result = mergeListingImageSelection(existing, incoming);

    expect(result.errorMessage).toBeNull();
    expect(result.addedFiles).toEqual(incoming);
    expect(result.files).toEqual([...existing, ...incoming]);
  });

  it("ignores duplicate gallery selections", () => {
    const existing = [{ name: "listing-image-1.jpg", size: 100, lastModified: 1 }] as File[];
    const incoming = [
      { name: "front.jpg", size: 100, lastModified: 1 },
      { name: "room.jpg", size: 200, lastModified: 2 }
    ] as File[];

    const result = mergeListingImageSelection(existing, incoming);

    expect(result.ignoredDuplicateCount).toBe(1);
    expect(result.files).toEqual([existing[0], incoming[1]]);
  });

  it("rejects only the excess add-more action when selection would exceed ten images", () => {
    const existing = Array.from({ length: 8 }, (_, index) => ({
      name: `existing-${index}.jpg`,
      size: 100 + index,
      lastModified: index + 1
    })) as File[];
    const incoming = Array.from({ length: 5 }, (_, index) => ({
      name: `incoming-${index}.jpg`,
      size: 300 + index,
      lastModified: index + 20
    })) as File[];

    const result = mergeListingImageSelection(existing, incoming);

    expect(result.files).toEqual(existing);
    expect(result.addedFiles).toEqual([]);
    expect(result.errorMessage).toBe(
      `You can upload up to ${MAX_LISTING_IMAGES} images per listing. Remove 3 images and try again.`
    );
  });

  it("keeps thumbnail selection stable when removing selected photos", () => {
    expect(getThumbnailIndexAfterImageRemoval(2, 0, 2)).toBe(1);
    expect(getThumbnailIndexAfterImageRemoval(1, 1, 2)).toBe(1);
    expect(getThumbnailIndexAfterImageRemoval(0, 0, 0)).toBe(0);
  });
});

describe("listing image original path validation", () => {
  it("allows only agent-owned temporary original paths", () => {
    expect(getListingOriginalPathBlockReason("agent-id", "agent-id/abc-0-original.heic")).toBeNull();
    expect(getListingOriginalPathBlockReason("agent-id", "other-agent/abc-0-original.heic")).toMatch(/belong/);
    expect(getListingOriginalPathBlockReason("agent-id", "agent-id/nested/abc-0-original.heic")).toMatch(/invalid/);
    expect(getListingOriginalPathBlockReason("agent-id", "agent-id/abc-0-original.gif")).toMatch(/not supported/);
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
