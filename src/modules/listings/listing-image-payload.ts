import { MAX_LISTING_IMAGES } from "@/lib/image-limits";

export type ListingImagePayloadErrorCode =
  | "LISTING_IMAGE_URL_INVALID"
  | "LISTING_IMAGE_OWNER_INVALID"
  | "LISTING_IMAGE_EXTENSION_INVALID"
  | "LISTING_IMAGE_METADATA_INVALID";

export class ListingImagePayloadError extends Error {
  code: ListingImagePayloadErrorCode;

  constructor(code: ListingImagePayloadErrorCode, message: string) {
    super(message);
    this.name = "ListingImagePayloadError";
    this.code = code;
  }
}

type PlainObject = Record<string, unknown>;

const IMAGE_PATH_PREFIX = "/storage/v1/object/public/listing-images/";
const FINAL_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const VARIANT_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "webp"]);
const BLUR_DATA_URL_PATTERN = /^data:image\/(webp|jpeg);base64,[a-z0-9+/=]+$/i;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getConfiguredSupabaseHost() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new ListingImagePayloadError(
      "LISTING_IMAGE_URL_INVALID",
      "Listing image storage is not configured. Upload code: LISTING_IMAGE_URL_INVALID"
    );
  }

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    throw new ListingImagePayloadError(
      "LISTING_IMAGE_URL_INVALID",
      "Listing image storage is not configured. Upload code: LISTING_IMAGE_URL_INVALID"
    );
  }
}

function getPathExtension(pathname: string) {
  return pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? null;
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new ListingImagePayloadError(
      "LISTING_IMAGE_URL_INVALID",
      "One or more image links are invalid. Please choose the images again and submit. Upload code: LISTING_IMAGE_URL_INVALID"
    );
  }
}

function verifyListingImageUrl(agentId: string, value: unknown, variantOnly: boolean) {
  if (typeof value !== "string") {
    throw new ListingImagePayloadError(
      "LISTING_IMAGE_URL_INVALID",
      "One or more image links are invalid. Please choose the images again and submit. Upload code: LISTING_IMAGE_URL_INVALID"
    );
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(value);
  } catch {
    throw new ListingImagePayloadError(
      "LISTING_IMAGE_URL_INVALID",
      "One or more image links are invalid. Please choose the images again and submit. Upload code: LISTING_IMAGE_URL_INVALID"
    );
  }

  if (
    imageUrl.protocol !== "https:" ||
    imageUrl.hostname !== getConfiguredSupabaseHost() ||
    !imageUrl.pathname.startsWith(IMAGE_PATH_PREFIX)
  ) {
    throw new ListingImagePayloadError(
      "LISTING_IMAGE_URL_INVALID",
      "One or more image links are invalid. Please choose the images again and submit. Upload code: LISTING_IMAGE_URL_INVALID"
    );
  }

  const relativePath = imageUrl.pathname.slice(IMAGE_PATH_PREFIX.length);
  const ownerSegment = relativePath.split("/")[0];

  if (decodePathSegment(ownerSegment) !== agentId) {
    throw new ListingImagePayloadError(
      "LISTING_IMAGE_OWNER_INVALID",
      "One or more images were uploaded, but could not be linked to your account. Please choose the images again and submit. Upload code: LISTING_IMAGE_OWNER_INVALID"
    );
  }

  const extension = getPathExtension(imageUrl.pathname);
  const allowedExtensions = variantOnly ? VARIANT_IMAGE_EXTENSIONS : FINAL_IMAGE_EXTENSIONS;
  if (!extension || !allowedExtensions.has(extension)) {
    throw new ListingImagePayloadError(
      "LISTING_IMAGE_EXTENSION_INVALID",
      "One or more images are in an unsupported final format. Use JPG, PNG, or WebP. Upload code: LISTING_IMAGE_EXTENSION_INVALID"
    );
  }

  return value;
}

function normalizeDimension(value: unknown, max: number) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  const rounded = Math.round(numberValue);
  return rounded > 0 && rounded <= max ? rounded : null;
}

function normalizeBlurDataUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  if (value.length > 3000 || !BLUR_DATA_URL_PATTERN.test(value)) {
    return null;
  }

  return value;
}

function normalizeVariant(agentId: string, variant: unknown) {
  if (!isPlainObject(variant)) {
    throw new ListingImagePayloadError(
      "LISTING_IMAGE_METADATA_INVALID",
      "One or more uploaded images returned invalid metadata. Please choose the images again and submit. Upload code: LISTING_IMAGE_METADATA_INVALID"
    );
  }

  return {
    ...variant,
    heroUrl: verifyListingImageUrl(agentId, variant.heroUrl, true),
    cardUrl: verifyListingImageUrl(agentId, variant.cardUrl, true),
    blurDataUrl: normalizeBlurDataUrl(variant.blurDataUrl),
    width: normalizeDimension(variant.width, 1200),
    height: normalizeDimension(variant.height, 900),
    cardWidth: normalizeDimension(variant.cardWidth, 600),
    cardHeight: normalizeDimension(variant.cardHeight, 450)
  };
}

export function normalizeAndVerifyListingImages(agentId: string, input: unknown) {
  if (!isPlainObject(input)) {
    return input;
  }

  const payload: PlainObject = { ...input };

  if (Array.isArray(payload.imageVariants)) {
    if (payload.imageVariants.length > MAX_LISTING_IMAGES) {
      return payload;
    }

    if (payload.imageVariants.length > 0) {
      const normalizedVariants = payload.imageVariants.map((variant) => normalizeVariant(agentId, variant));
      payload.imageVariants = normalizedVariants;

      payload.imageUrls = normalizedVariants.map((variant) => variant.heroUrl);
      return payload;
    }
  }

  if (Array.isArray(payload.imageUrls)) {
    payload.imageUrls = payload.imageUrls.map((url) => verifyListingImageUrl(agentId, url, false));
  }

  return payload;
}
