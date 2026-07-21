"use client";

import { processListingImage, type ListingImageWatermark } from "@/lib/image";
import { getAgentDisplayName } from "@/lib/agent-display";
import { apiRequest } from "@/lib/api";
import {
  getListingImageFormatErrorMessage,
  getListingImageExtensionForType,
  getListingImageCountLimitMessage,
  isServerConvertedListingImageFile,
  isSupportedListingImageFile,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGE_MB,
  normalizeListingImageType,
  SUPPORTED_LISTING_IMAGE_LABEL
} from "@/lib/image-limits";
import { createListingOriginalPath, LISTING_IMAGE_ORIGINALS_BUCKET } from "@/lib/listing-image-originals";
import { supabase } from "@/lib/supabase/client";
import { getEffectivePlanSlug } from "@/lib/subscriptions";
import type { ListingImageVariant, SubscriptionRecord } from "@/lib/types";

type ListingImageUploadResult = {
  imageUrls: string[];
  imageVariants: ListingImageVariant[];
};

type UploadStage =
  | "authorize"
  | "process"
  | "optimized-upload"
  | "processed-server-upload"
  | "temp-upload"
  | "server-convert";

type AgentWatermarkResponse = {
  user: {
    fullName: string;
  } | null;
  profile: {
    agent?: {
      businessName: string | null;
    } | null;
    subscription?: SubscriptionRecord | null;
  };
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

async function uploadViaServerFallback(file: Blob, token: string, filename: string) {
  const form = new FormData();
  form.append("file", file, filename);

  const response = await fetch("/api/uploads/listing-images/fallback", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? "Image upload failed. Please try again.");
  }

  const body = (await response.json()) as { url?: string };
  if (!body.url) {
    throw new Error("Image upload failed. Please try again.");
  }

  return body.url;
}

async function convertViaServer(originals: Array<{ path: string; order: number }>, token: string) {
  const response = await fetch("/api/uploads/listing-images/convert", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ originals })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? "We could not process this phone photo. Try exporting it as JPG and upload again.");
  }

  return (await response.json()) as ListingImageUploadResult;
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

async function getListingImageWatermark(token: string): Promise<ListingImageWatermark> {
  try {
    const response = await apiRequest<AgentWatermarkResponse>("/api/agents/me", {
      headers: { Authorization: `Bearer ${token}` },
      retries: 0
    });
    const planSlug = getEffectivePlanSlug(response.profile.subscription ?? null);

    if (planSlug === "pro_agent" || planSlug === "agency_plus") {
      const fullName = response.user?.fullName ?? "Verified Agent";
      return { type: "agent", text: getAgentDisplayName(fullName, response.profile.agent?.businessName) };
    }
  } catch (error) {
    console.warn("Could not load listing watermark context; using platform watermark.", {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }

  return { type: "platform" };
}

function safeImageName(index: number, type: ReturnType<typeof normalizeListingImageType>) {
  if (!type) {
    throw new Error(`This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`);
  }

  return `listing-image-${index + 1}.${getListingImageExtensionForType(type)}`;
}

export function normalizeListingImageFile(file: File, index: number) {
  const formatError = getListingImageFormatErrorMessage(file);
  const normalizedType = normalizeListingImageType(file);

  if (formatError || !normalizedType) {
    throw new Error(formatError ?? `This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`);
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

async function uploadOriginalsForServerConversion(files: File[], token: string, userId: string) {
  const originals: Array<{ path: string; order: number }> = [];

  try {
    for (const [index, file] of files.entries()) {
      const path = createListingOriginalPath(userId, index, file);
      originals.push({ path, order: index });
      const { error } = await supabase.storage.from(LISTING_IMAGE_ORIGINALS_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false
      });

      if (error) {
        throw error;
      }
    }

    return await convertViaServer(originals, token);
  } catch (error) {
    if (originals.length) {
      await supabase.storage
        .from(LISTING_IMAGE_ORIGINALS_BUCKET)
        .remove(originals.map((original) => original.path))
        .catch(() => undefined);
    }

    warnUploadFallback("server-convert", files, error);
    throw error;
  }
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
  const countLimitMessage = getListingImageCountLimitMessage(files.length);

  if (countLimitMessage) {
    throw new Error(countLimitMessage);
  }

  const acceptedFiles = files.map(normalizeListingImageFile);
  const unsupportedFile = acceptedFiles.find((file) => !isSupportedListingImageFile(file));
  const oversizedFile = acceptedFiles.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);

  if (unsupportedFile) {
    throw new Error(`This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`);
  }

  if (oversizedFile) {
    throw new Error(`Each image must be ${MAX_LISTING_IMAGE_MB} MB or less before compression.`);
  }

  try {
    await authorizeListingImageUpload(acceptedFiles, token);
  } catch (error) {
    warnUploadFallback("authorize", acceptedFiles, error);
    throw error;
  }

  if (acceptedFiles.some(isServerConvertedListingImageFile)) {
    try {
      return await uploadOriginalsForServerConversion(acceptedFiles, token, userId);
    } catch (error) {
      warnUploadFallback("temp-upload", acceptedFiles, error);
      throw error;
    }
  }

  const watermark = await getListingImageWatermark(token);
  let processedImages: Awaited<ReturnType<typeof processListingImage>>[];

  try {
    processedImages = await Promise.all(acceptedFiles.map((file) => processListingImage(file, watermark)));
  } catch (error) {
    if (!isImageProcessingFailure(error)) {
      throw error;
    }

    warnUploadFallback("process", acceptedFiles, error);
    try {
      return await uploadOriginalsForServerConversion(acceptedFiles, token, userId);
    } catch (conversionError) {
      warnUploadFallback("server-convert", acceptedFiles, conversionError);
      throw conversionError;
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
      const fallbackVariants = await Promise.all(
        processedImages.map(async (optimized, index): Promise<ListingImageVariant> => {
          const [heroUrl, cardUrl] = await Promise.all([
            uploadViaServerFallback(optimized.hero, token, `listing-image-${index + 1}-hero.webp`),
            uploadViaServerFallback(optimized.card, token, `listing-image-${index + 1}-card.webp`)
          ]);

          return {
            heroUrl,
            cardUrl,
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
        imageUrls: fallbackVariants.map((image) => image.heroUrl),
        imageVariants: fallbackVariants
      };
    } catch (serverUploadError) {
      warnUploadFallback("processed-server-upload", acceptedFiles, serverUploadError);
      throw serverUploadError;
    }
  }

  return {
    imageUrls: imageVariants.map((image) => image.heroUrl),
    imageVariants
  };
}
