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

export async function uploadListingImages(files: File[], token: string) {
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

  const uploads = acceptedFiles.map(async (file, index): Promise<ListingImageVariant> => {
    const optimized = await processListingImage(file);
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
  });

  return Promise.all(uploads);
}
