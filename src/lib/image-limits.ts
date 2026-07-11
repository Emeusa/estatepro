export const MAX_LISTING_IMAGES = 10;
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_LISTING_IMAGE_MB = MAX_LISTING_IMAGE_BYTES / (1024 * 1024);
export const SUPPORTED_LISTING_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SUPPORTED_LISTING_IMAGE_ACCEPT = `${SUPPORTED_LISTING_IMAGE_TYPES.join(",")},.jpg,.jpeg,.png,.webp`;
export const SUPPORTED_LISTING_IMAGE_LABEL = "JPG, PNG, and WebP";

const MIME_BY_EXTENSION: Record<string, (typeof SUPPORTED_LISTING_IMAGE_TYPES)[number]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

const EXTENSION_BY_MIME: Record<(typeof SUPPORTED_LISTING_IMAGE_TYPES)[number], "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export function getListingImageExtension(name: string) {
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  return MIME_BY_EXTENSION[extension] ? extension : null;
}

export function isUnsupportedHeicImage(file: Pick<File, "name" | "type">) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

export function normalizeListingImageType(file: Pick<File, "name" | "type">) {
  const type = file.type.toLowerCase();

  if (type === "image/jpg") {
    return "image/jpeg";
  }

  if (SUPPORTED_LISTING_IMAGE_TYPES.includes(type as (typeof SUPPORTED_LISTING_IMAGE_TYPES)[number])) {
    return type as (typeof SUPPORTED_LISTING_IMAGE_TYPES)[number];
  }

  const extension = getListingImageExtension(file.name);
  return extension ? MIME_BY_EXTENSION[extension] : null;
}

export function getListingImageExtensionForType(type: (typeof SUPPORTED_LISTING_IMAGE_TYPES)[number]) {
  return EXTENSION_BY_MIME[type];
}

export function isSupportedListingImageType(type: string) {
  return SUPPORTED_LISTING_IMAGE_TYPES.includes(type as (typeof SUPPORTED_LISTING_IMAGE_TYPES)[number]);
}

export function isSupportedListingImageFile(file: Pick<File, "name" | "type">) {
  return !isUnsupportedHeicImage(file) && normalizeListingImageType(file) !== null;
}
