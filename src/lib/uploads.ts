"use client";

import { processListingImage } from "@/lib/image";
import { apiRequest } from "@/lib/api";
import {
  getListingImageExtensionForType,
  isSupportedListingImageFile,
  isUnsupportedHeicImage,
  MAX_LISTING_IMAGES,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGE_MB,
  normalizeListingImageType,
  SUPPORTED_LISTING_IMAGE_LABEL
} from "@/lib/image-limits";
import { supabase } from "@/lib/supabase/client";
import { ListingImageVariant } from "@/lib/types";

type ListingImageUploadResult = {
  imageUrls: string[];
  imageVariants: ListingImageVariant[];
};

type UploadStage = "authorize" | "process" | "optimized-upload" | "raw-upload";

async function requireUserId() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error("You must be logged in before uploading files.");
  }

  return session.user.id;
}

async function upload(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function authorizeListingImageUpload(files: File[], token: string) {
  await apiRequest("/api/uploads/listing-images/authorize", {
    method: "POST",
    retries: 0,
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      files: files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type
      }))
    })
  });
}

function getRawImageExtension(file: File) {
  const normalizedType = normalizeListingImageType(file);

  if (!normalizedType) {
    throw new Error(`Only ${SUPPORTED_LISTING_IMAGE_LABEL} images are supported.`);
  }

  return getListingImageExtensionForType(normalizedType);
}

function safeImageName(index: number, type: ReturnType<typeof normalizeListingImageType>) {
  if (!type) {
    throw new Error(`Only ${SUPPORTED_LISTING_IMAGE_LABEL} images are supported.`);
  }

  return `listing-image-${index + 1}.${getListingImageExtensionForType(type)}`;
}

function normalizeListingImageFile(file: File, index: number) {
  if (isUnsupportedHeicImage(file)) {
    throw new Error("HEIC images are not supported yet. Please choose JPG, PNG, or WebP.");
  }

  const normalizedType = normalizeListingImageType(file);
  if (!normalizedType) {
    throw new Error(`Only ${SUPPORTED_LISTING_IMAGE_LABEL} images are supported.`);
  }

  const normalizedName = safeImageName(index, normalizedType);
  if (file.type === normalizedType && file.name.toLowerCase().endsWith(`.${getListingImageExtensionForType(normalizedType)}`)) {
    return file;
  }

  return new File([file], normalizedName, {
    type: normalizedType,
    lastModified: file.lastModified
  });
}

function warnUploadFallback(stage: UploadStage, files: File[], error: unknown) {
  console.warn("Listing image upload fallback triggered.", {
    stage,
    count: files.length,
    types: files.map((file) => file.type),
    reason: error instanceof Error ? error.message : "unknown"
  });
}

async function uploadOriginalListingImages(files: File[], userId: string): Promise<string[]> {
  return Promise.all(
    files.map(async (file, index) => {
      const imageId = crypto.randomUUID();
      const extension = getRawImageExtension(file);
      const path = `${userId}/${imageId}-${index}-original.${extension}`;

      await upload("listing-images", path, file);

      return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
    })
  );
}

function isImageProcessingFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("compression") ||
    message.includes("convert") ||
    message.includes("decode") ||
    message.includes("dimension") ||
    message.includes("image") ||
    message.includes("load") ||
    message.includes("canvas") ||
    message.includes("webp") ||
    message.includes("todataurl") ||
    message.includes("toblob")
  );
}

function isSetupOrAuthUploadFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("logged in") ||
    message.includes("session") ||
    message.includes("jwt") ||
    message.includes("bucket") ||
    message.includes("not found") ||
    message.includes("row-level security") ||
    message.includes("rls") ||
    message.includes("policy") ||
    message.includes("permission") ||
    message.includes("unauthorized") ||
    message.includes("size") ||
    message.includes("too large")
  );
}

function isOptimizedUploadFallbackCandidate(error: unknown) {
  if (!(error instanceof Error) || isSetupOrAuthUploadFailure(error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("abort") ||
    message.includes("body") ||
    message.includes("mime") ||
    message.includes("webp") ||
    message.includes("storage")
  );
}

export async function uploadListingImages(files: File[], token: string): Promise<ListingImageUploadResult> {
  const userId = await requireUserId();
  const acceptedFiles = files.slice(0, MAX_LISTING_IMAGES).map(normalizeListingImageFile);
  const unsupportedFile = acceptedFiles.find((file) => !isSupportedListingImageFile(file));
  const oversizedFile = acceptedFiles.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);

  if (unsupportedFile) {
    throw new Error(`Only ${SUPPORTED_LISTING_IMAGE_LABEL} images are supported.`);
  }

  if (oversizedFile) {
    throw new Error(`Each property image must be ${MAX_LISTING_IMAGE_MB} MB or less.`);
  }

  try {
    await authorizeListingImageUpload(acceptedFiles, token);
  } catch (error) {
    warnUploadFallback("authorize", acceptedFiles, error);
    throw error;
  }

  let processedImages: Awaited<ReturnType<typeof processListingImage>>[];

  try {
    processedImages = await Promise.all(acceptedFiles.map((file) => processListingImage(file)));
  } catch (error) {
    if (!isImageProcessingFailure(error)) {
      throw error;
    }

    warnUploadFallback("process", acceptedFiles, error);
    try {
      return {
        imageUrls: await uploadOriginalListingImages(acceptedFiles, userId),
        imageVariants: []
      };
    } catch (rawUploadError) {
      warnUploadFallback("raw-upload", acceptedFiles, rawUploadError);
      throw rawUploadError;
    }
  }

  let imageVariants: ListingImageVariant[];

  try {
    imageVariants = await Promise.all(
      processedImages.map(async (optimized, index): Promise<ListingImageVariant> => {
        const imageId = crypto.randomUUID();
        const heroPath = `${userId}/${imageId}-${index}-hero.webp`;
        const cardPath = `${userId}/${imageId}-${index}-card.webp`;

        await upload("listing-images", heroPath, optimized.hero);
        await upload("listing-images", cardPath, optimized.card);

        return {
          heroUrl: supabase.storage.from("listing-images").getPublicUrl(heroPath).data.publicUrl,
          cardUrl: supabase.storage.from("listing-images").getPublicUrl(cardPath).data.publicUrl,
          blurDataUrl: optimized.blurDataUrl,
          width: optimized.width,
          height: optimized.height,
          cardWidth: optimized.cardWidth,
          cardHeight: optimized.cardHeight,
          order: index
        };
      })
    );
  } catch (error) {
    if (!isOptimizedUploadFallbackCandidate(error)) {
      throw error;
    }

    warnUploadFallback("optimized-upload", acceptedFiles, error);
    try {
      return {
        imageUrls: await uploadOriginalListingImages(acceptedFiles, userId),
        imageVariants: []
      };
    } catch (rawUploadError) {
      warnUploadFallback("raw-upload", acceptedFiles, rawUploadError);
      throw rawUploadError;
    }
  }

  return {
    imageUrls: imageVariants.map((image) => image.heroUrl),
    imageVariants
  };
}
