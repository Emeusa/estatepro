export const MAX_LISTING_IMAGES = 15;
export const MAX_LISTING_FINAL_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_LISTING_FINAL_IMAGE_MB = MAX_LISTING_FINAL_IMAGE_BYTES / (1024 * 1024);
export const MAX_LISTING_ORIGINAL_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_LISTING_ORIGINAL_IMAGE_MB = MAX_LISTING_ORIGINAL_IMAGE_BYTES / (1024 * 1024);
export const MAX_LISTING_IMAGE_BYTES = MAX_LISTING_ORIGINAL_IMAGE_BYTES;
export const MAX_LISTING_IMAGE_MB = MAX_LISTING_ORIGINAL_IMAGE_MB;
export const BROWSER_PROCESSABLE_LISTING_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const LISTING_PHONE_GALLERY_ACCEPT = "image/*";
export const LISTING_GALLERY_PICKER_ACCEPT = `${BROWSER_PROCESSABLE_LISTING_IMAGE_TYPES.join(
  ","
)},.jpg,.jpeg,.jpe,.jfif,.png,.webp`;
export const SUPPORTED_LISTING_IMAGE_TYPES = [...BROWSER_PROCESSABLE_LISTING_IMAGE_TYPES] as const;
export const SUPPORTED_LISTING_IMAGE_ACCEPT = `${SUPPORTED_LISTING_IMAGE_TYPES.join(
  ","
)},.jpg,.jpeg,.jpe,.jfif,.png,.webp`;
export const SUPPORTED_LISTING_IMAGE_LABEL = "JPG, PNG, and WebP";
export const PHONE_HIGH_EFFICIENCY_IMAGE_MESSAGE =
  "This phone photo format is not ready for direct upload. On iPhone, choose Options and send as JPG/Most Compatible, then upload again.";

const MIME_BY_EXTENSION: Record<string, (typeof SUPPORTED_LISTING_IMAGE_TYPES)[number]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

const EXTENSION_BY_MIME: Record<(typeof SUPPORTED_LISTING_IMAGE_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const RAW_LISTING_IMAGE_EXTENSIONS = new Set(["dng", "raw", "arw", "cr2", "cr3", "nef", "nrw", "orf", "raf", "rw2"]);
const PHONE_HIGH_EFFICIENCY_EXTENSIONS = new Set(["heic", "heif", "avif"]);

export function getListingImageExtension(name: string) {
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  return MIME_BY_EXTENSION[extension] ? extension : null;
}

export function getListingImageFileExtension(name: string) {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? null;
}

export function isRawListingImageFile(file: Pick<File, "name" | "type">) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const extension = getListingImageFileExtension(name);
  return type.includes("raw") || type === "image/x-adobe-dng" || Boolean(extension && RAW_LISTING_IMAGE_EXTENSIONS.has(extension));
}

export function isPhoneHighEfficiencyListingImageFile(file: Pick<File, "name" | "type">) {
  const type = file.type.toLowerCase();
  const extension = getListingImageFileExtension(file.name);
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    type === "image/avif" ||
    Boolean(extension && PHONE_HIGH_EFFICIENCY_EXTENSIONS.has(extension))
  );
}

export function normalizeListingImageType(file: Pick<File, "name" | "type">) {
  const type = file.type.toLowerCase();

  if (type === "image/jpg" || type === "image/pjpeg") {
    return "image/jpeg";
  }

  if (type === "image/x-png") {
    return "image/png";
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
  return !isRawListingImageFile(file) && !isPhoneHighEfficiencyListingImageFile(file) && normalizeListingImageType(file) !== null;
}

export function getListingImageFormatErrorMessage(file: Pick<File, "name" | "type">) {
  if (isRawListingImageFile(file)) {
    return "RAW photos are too large for listing uploads. Export as JPG first.";
  }

  if (isPhoneHighEfficiencyListingImageFile(file)) {
    return PHONE_HIGH_EFFICIENCY_IMAGE_MESSAGE;
  }

  if (!normalizeListingImageType(file)) {
    return `This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`;
  }

  return null;
}

export function getListingImageCountLimitMessage(count: number) {
  const excessCount = Math.max(count - MAX_LISTING_IMAGES, 0);

  if (excessCount <= 0) {
    return null;
  }

  return `You can upload up to ${MAX_LISTING_IMAGES} images per listing. Remove ${excessCount} ${
    excessCount === 1 ? "image" : "images"
  } and try again.`;
}
