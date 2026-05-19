export const MAX_LISTING_IMAGES = 10;
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_LISTING_IMAGE_MB = MAX_LISTING_IMAGE_BYTES / (1024 * 1024);
export const SUPPORTED_LISTING_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SUPPORTED_LISTING_IMAGE_ACCEPT = SUPPORTED_LISTING_IMAGE_TYPES.join(",");
export const SUPPORTED_LISTING_IMAGE_LABEL = "JPG, PNG, and WebP";

export function isSupportedListingImageType(type: string) {
  return SUPPORTED_LISTING_IMAGE_TYPES.includes(type as (typeof SUPPORTED_LISTING_IMAGE_TYPES)[number]);
}
