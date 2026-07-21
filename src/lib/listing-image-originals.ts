import { getListingImageExtensionForType, normalizeListingImageType } from "@/lib/image-limits";

export const LISTING_IMAGE_ORIGINALS_BUCKET = "listing-image-originals";

const LISTING_ORIGINAL_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "jpe", "jfif", "png", "webp", "heic", "heif", "avif"]);

export function createListingOriginalPath(agentId: string, index: number, file: Pick<File, "name" | "type">) {
  const normalizedType = normalizeListingImageType(file);
  if (!normalizedType) {
    throw new Error("This file type is not supported.");
  }

  return `${agentId}/${crypto.randomUUID()}-${index}-original.${getListingImageExtensionForType(normalizedType)}`;
}

export function getListingOriginalPathBlockReason(agentId: string, path: string) {
  const [owner, filename, ...extraParts] = path.split("/");

  if (owner !== agentId) {
    return "Original image path does not belong to this agent.";
  }

  if (!filename || extraParts.length > 0) {
    return "Original image path is invalid.";
  }

  const match = filename.toLowerCase().match(/^[a-z0-9-]+-\d+-original\.([a-z0-9]+)$/);
  if (!match) {
    return "Original image path is invalid.";
  }

  if (!LISTING_ORIGINAL_IMAGE_EXTENSIONS.has(match[1])) {
    return "Original image format is not supported.";
  }

  return null;
}
