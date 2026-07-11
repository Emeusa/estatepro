"use client";

import { processListingImage } from "@/lib/image";
import { apiRequest } from "@/lib/api";
import {
  isSupportedListingImageType,
  MAX_LISTING_IMAGES,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGE_MB,
  SUPPORTED_LISTING_IMAGE_LABEL
} from "@/lib/image-limits";
import { supabase } from "@/lib/supabase/client";
import { ListingImageVariant } from "@/lib/types";

type ListingImageUploadResult = {
  imageUrls: string[];
  imageVariants: ListingImageVariant[];
};

const RAW_IMAGE_EXTENSIONS: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

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
  const extension = RAW_IMAGE_EXTENSIONS[file.type];

  if (!extension) {
    throw new Error(`Only ${SUPPORTED_LISTING_IMAGE_LABEL} images are supported.`);
  }

  return extension;
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

export async function uploadListingImages(files: File[], token: string): Promise<ListingImageUploadResult> {
  const userId = await requireUserId();
  const unsupportedFile = files.find((file) => !isSupportedListingImageType(file.type));
  const oversizedFile = files.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);

  if (unsupportedFile) {
    throw new Error(`Only ${SUPPORTED_LISTING_IMAGE_LABEL} images are supported.`);
  }

  if (oversizedFile) {
    throw new Error(`Each property image must be ${MAX_LISTING_IMAGE_MB} MB or less.`);
  }

  const acceptedFiles = files.slice(0, MAX_LISTING_IMAGES);
  await authorizeListingImageUpload(acceptedFiles, token);

  let processedImages: Awaited<ReturnType<typeof processListingImage>>[];

  try {
    processedImages = await Promise.all(acceptedFiles.map((file) => processListingImage(file)));
  } catch (error) {
    if (!isImageProcessingFailure(error)) {
      throw error;
    }

    console.warn("Listing image optimization failed; uploading validated original images instead.");
    return {
      imageUrls: await uploadOriginalListingImages(acceptedFiles, userId),
      imageVariants: []
    };
  }

  const imageVariants = await Promise.all(
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

  return {
    imageUrls: imageVariants.map((image) => image.heroUrl),
    imageVariants
  };
}
