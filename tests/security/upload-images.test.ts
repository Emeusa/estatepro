import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  detectListingImageTypeFromSignature,
  getListingImageCountLimitMessage,
  getListingImageFormatErrorMessageAsync,
  getListingImageFormatErrorMessage,
  isPhoneHighEfficiencyListingImageFile,
  isRawListingImageFile,
  isSupportedListingImageFile,
  LISTING_GALLERY_PICKER_ACCEPT,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGES,
  MAX_LISTING_ORIGINAL_IMAGE_BYTES,
  PHONE_HIGH_EFFICIENCY_IMAGE_MESSAGE,
  normalizeListingImageTypeAsync,
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

  it("returns stable server upload error codes", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "src/app/api/uploads/listing-images/fallback/route.ts"),
      "utf8"
    );

    expect(routeSource).toContain("UPLOAD_SESSION_EXPIRED");
    expect(routeSource).toContain("UPLOAD_AGENT_BLOCKED");
    expect(routeSource).toContain("UPLOAD_FILE_TYPE_INVALID");
    expect(routeSource).toContain("UPLOAD_FINAL_SIZE_EXCEEDED");
    expect(routeSource).toContain("UPLOAD_STORAGE_FAILED");
  });

  it("does not classify unrelated policy wording as an image-storage failure", () => {
    const formSource = readFileSync(path.join(process.cwd(), "src/components/forms/listing-form.tsx"), "utf8");

    expect(formSource).toContain('message.includes("upload_storage_failed")');
    expect(formSource).not.toContain('message.includes("row-level security")');
    expect(formSource).not.toContain('message.includes("permission")');
    expect(formSource).not.toContain('message.includes("unauthorized")');
  });

  it("uses one hidden gallery picker with a simple thumbnail selector", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/listing-form.tsx"), "utf8");

    expect(source.match(/name="images"/g) ?? []).toHaveLength(1);
    expect(source).toContain("Select photos from gallery");
    expect(source).toContain('name="images"');
    expect(source).toContain('type="file"');
    expect(source).toContain("multiple");
    expect(source).toContain('accept="image/*"');
    expect(source).toContain('className="sr-only"');
    expect(source).toContain("Choose photos from your gallery.");
    expect(source).toContain("photos selected");
    expect(source).toContain("Choose upload thumbnail");
    expect(source).toContain("Thumbnail selected");
    expect(source).toContain("createListingImagePreview(file)");
    expect(source).toContain("normalizeListingImageFileAsync");
    expect(source).toContain("setPreviewUrls([])");
    expect(source).toContain("const inputElement = event.currentTarget");
    expect(source).not.toContain("LISTING_PHONE_GALLERY_ACCEPT");
    expect(source).not.toContain("accept={LISTING_GALLERY_PICKER_ACCEPT}");
    expect(source).not.toContain('className="input"\n          name="images"');
    expect(source).not.toContain("files.map(getListingImageFormatErrorMessage)");
    expect(source).not.toContain("files.find((file) => !isSupportedListingImageFile(file))");
    expect(source).not.toContain("URL.createObjectURL(file)");
    expect(source).not.toContain("If some albums do not show");
    expect(source).not.toContain("Review selected photos");
    expect(source).not.toContain("Clear all");
    expect(source).not.toContain("Remove");
    expect(source).not.toContain("formatImageSize");
  });

  it("uses a posting label and spinner on the listing submit button", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/listing-form.tsx"), "utf8");

    expect(source).toContain("Post Property");
    expect(source).toContain("Posting property...");
    expect(source).toContain("animate-spin");
    expect(source).toContain("inline-flex items-center justify-center gap-2");
    expect(source).not.toContain("Save listing");
    expect(source).not.toContain("Saving...");
  });

  it("shows slow upload progress without changing the picker or upload flow", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/listing-form.tsx"), "utf8");
    const uploadSource = readFileSync(path.join(process.cwd(), "src/lib/uploads.ts"), "utf8");

    expect(source).toContain("uploadProgressMessage");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Large photos can take a few minutes on mobile. Do not close or refresh this page.");
    expect(source).toContain("Saving listing details...");
    expect(source).toContain("disabled={isSubmitting}");
    expect(uploadSource).toContain("type ListingImageUploadProgress");
    expect(uploadSource).toContain("onProgress?.({ stage: \"processing\"");
    expect(uploadSource).toContain("onProgress?.({ stage: \"uploading\"");
    expect(uploadSource).toContain("/api/uploads/listing-images/fallback");
    expect(uploadSource).toContain("requireFreshSessionToken");
    expect(uploadSource).not.toContain("/api/uploads/listing-images/authorize");
    expect(uploadSource).not.toContain("/api/uploads/listing-images/convert");
    expect(uploadSource).not.toContain("listing-image-originals");
    expect(uploadSource).not.toContain(".storage.from(\"listing-images\").upload");
  });

  it("refreshes the auth token at listing submit time", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/listing-form.tsx"), "utf8");

    expect(source).toContain("async function getFreshSubmitToken");
    expect(source).toContain("await supabase.auth.getSession()");
    expect(source).toContain("const submitToken = await getFreshSubmitToken()");
    expect(source).toContain("uploadListingImages(orderedImageFiles, submitToken");
    expect(source).toContain("Authorization: `Bearer ${submitToken}`");
  });

  it("uses memory-safe browser image processing for large mobile photos", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/image.ts"), "utf8");

    expect(source).toContain("createImageBitmap(blob");
    expect(source).toContain("resizeWidth: size.width");
    expect(source).toContain("resizeHeight: size.height");
    expect(source).toContain("renderImageWithRetry");
    expect(source).toContain("SAFE_HERO_MAX_WIDTH");
    expect(source).toContain("SAFE_CARD_MAX_WIDTH");
    expect(source).toContain("renderImageFromBlob(hero.blob");
    expect(source).toContain("createListingImagePreview");
  });

  it("keeps upload validation strict after gallery selection", () => {
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

  it("accepts valid JPEG content when Android returns blank or generic metadata", async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const blankMimeFile = new File([jpegBytes], "content", { type: "" });
    const genericMimeFile = new File([jpegBytes], "content", { type: "application/octet-stream" });

    expect(detectListingImageTypeFromSignature(jpegBytes)).toBe("image/jpeg");
    await expect(normalizeListingImageTypeAsync(blankMimeFile)).resolves.toBe("image/jpeg");
    await expect(normalizeListingImageTypeAsync(genericMimeFile)).resolves.toBe("image/jpeg");
    await expect(getListingImageFormatErrorMessageAsync(genericMimeFile)).resolves.toBeNull();
  });

  it("accepts valid PNG and WebP content when picker metadata is unreliable", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webpBytes = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46,
      0x18,
      0x00,
      0x00,
      0x00,
      0x57,
      0x45,
      0x42,
      0x50
    ]);

    await expect(normalizeListingImageTypeAsync(new File([pngBytes], "content", { type: "" }))).resolves.toBe("image/png");
    await expect(normalizeListingImageTypeAsync(new File([webpBytes], "content", { type: "" }))).resolves.toBe("image/webp");
  });

  it("uses phone guidance for HEIC and AVIF content signatures", async () => {
    const heicBytes = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x18,
      0x66,
      0x74,
      0x79,
      0x70,
      0x68,
      0x65,
      0x69,
      0x63,
      0x00,
      0x00,
      0x00,
      0x00
    ]);
    const avifBytes = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x18,
      0x66,
      0x74,
      0x79,
      0x70,
      0x61,
      0x76,
      0x69,
      0x66,
      0x00,
      0x00,
      0x00,
      0x00
    ]);

    expect(detectListingImageTypeFromSignature(heicBytes)).toBe("phone-high-efficiency");
    await expect(getListingImageFormatErrorMessageAsync(new File([heicBytes], "content", { type: "" }))).resolves.toBe(
      PHONE_HIGH_EFFICIENCY_IMAGE_MESSAGE
    );
    await expect(getListingImageFormatErrorMessageAsync(new File([avifBytes], "content", { type: "" }))).resolves.toBe(
      PHONE_HIGH_EFFICIENCY_IMAGE_MESSAGE
    );
  });

  it("rejects unknown content when metadata and filename are unreliable", async () => {
    const file = new File([new Uint8Array([0x01, 0x02, 0x03, 0x04])], "content", { type: "" });

    await expect(normalizeListingImageTypeAsync(file)).resolves.toBeNull();
    await expect(getListingImageFormatErrorMessageAsync(file)).resolves.toBe(
      "This file type is not supported. Upload JPG, PNG, and WebP images."
    );
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
