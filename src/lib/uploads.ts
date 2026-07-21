"use client";

import { processListingImage, type ListingImageWatermark } from "@/lib/image";
import { getAgentDisplayName } from "@/lib/agent-display";
import { apiRequest } from "@/lib/api";
import {
  BROWSER_PROCESSABLE_LISTING_IMAGE_TYPES,
  getListingImageFormatErrorMessage,
  getListingImageExtensionForType,
  getListingImageCountLimitMessage,
  isServerConvertedListingImageFile,
  isSupportedListingImageFile,
  MAX_LISTING_FINAL_IMAGE_BYTES,
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

const SELECTED_PHOTO_UPLOAD_FAILED_MESSAGE =
  "We could not upload the selected photos. Check your connection and try again with fewer photos.";
const TEMP_IMAGE_STORAGE_SETUP_MESSAGE = "Temporary image storage is not configured. Run the latest Supabase storage setup.";
const TEMP_IMAGE_STORAGE_POLICY_MESSAGE = "Temporary image storage is blocked by Supabase policy. Run the latest storage policies.";
const TEMP_IMAGE_ORIGINAL_UPLOAD_FAILED_MESSAGE =
  "We could not upload temporary copies of these photos for compression. Try smaller photos or fewer photos.";
const PHONE_PHOTO_PROCESSING_FAILED_MESSAGE =
  "We could not compress one of these phone photos. Try uploading fewer photos or export the photo as JPG.";
const SERVER_UPLOAD_RESPONSE_FAILED_MESSAGE = "Server upload completed without an image URL. Try again with fewer photos.";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requireUserId() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error("You must be logged in before uploading files.");
  }

  return session.user.id;
}

function isTransientStorageFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("abort") ||
    message.includes("temporarily") ||
    message.includes("storage") ||
    message.includes("body")
  );
}

async function upload(bucket: string, path: string, file: File, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false
    });

    if (!error) {
      return;
    }

    const uploadError = new Error(error.message);
    if (!isTransientStorageFailure(uploadError) || attempt === retries) {
      throw uploadError;
    }

    await sleep(350 * (attempt + 1));
  }
}

async function uploadViaServerFallback(file: Blob, token: string, filename: string) {
  const form = new FormData();
  form.append("file", file, filename);

  let response: Response;
  try {
    response = await fetch("/api/uploads/listing-images/fallback", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
  } catch {
    throw new Error(SELECTED_PHOTO_UPLOAD_FAILED_MESSAGE);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? SELECTED_PHOTO_UPLOAD_FAILED_MESSAGE);
  }

  const body = (await response.json()) as { url?: string };
  if (!body.url) {
    throw new Error(SERVER_UPLOAD_RESPONSE_FAILED_MESSAGE);
  }

  return body.url;
}

async function convertViaServer(originals: Array<{ path: string; order: number }>, token: string) {
  let response: Response;
  try {
    response = await fetch("/api/uploads/listing-images/convert", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ originals })
    });
  } catch {
    throw new Error(PHONE_PHOTO_PROCESSING_FAILED_MESSAGE);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? PHONE_PHOTO_PROCESSING_FAILED_MESSAGE);
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

function warnUploadFallback(stage: UploadStage, files: File[], error: unknown, failedIndex?: number) {
  console.warn("Listing image upload fallback triggered.", {
    stage,
    count: files.length,
    types: files.map((file) => file.type),
    sizes: files.map((file) => file.size),
    failedIndex,
    reason: error instanceof Error ? error.message : "unknown"
  });
}

function getTemporaryOriginalUploadErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return SELECTED_PHOTO_UPLOAD_FAILED_MESSAGE;
  }

  const message = error.message.toLowerCase();

  if (message.includes("bucket") || message.includes("not found")) {
    return TEMP_IMAGE_STORAGE_SETUP_MESSAGE;
  }

  if (
    message.includes("row-level security") ||
    message.includes("rls") ||
    message.includes("policy") ||
    message.includes("permission") ||
    message.includes("unauthorized")
  ) {
    return TEMP_IMAGE_STORAGE_POLICY_MESSAGE;
  }

  if (message.includes("size") || message.includes("too large")) {
    return `Each image must be ${MAX_LISTING_IMAGE_MB} MB or less before compression.`;
  }

  if (isTransientStorageFailure(error)) {
    return TEMP_IMAGE_ORIGINAL_UPLOAD_FAILED_MESSAGE;
  }

  return "We could not prepare these phone photos for compression. Try uploading fewer photos.";
}

function canUploadOriginalsThroughServerFallback(files: File[]) {
  return files.every((file) => {
    const normalizedType = normalizeListingImageType(file);
    return (
      normalizedType &&
      BROWSER_PROCESSABLE_LISTING_IMAGE_TYPES.includes(normalizedType as (typeof BROWSER_PROCESSABLE_LISTING_IMAGE_TYPES)[number]) &&
      file.size <= MAX_LISTING_FINAL_IMAGE_BYTES
    );
  });
}

async function uploadOriginalsThroughServerFallback(files: File[], token: string): Promise<ListingImageUploadResult> {
  const urls: string[] = [];

  for (const [index, file] of files.entries()) {
    urls.push(await uploadViaServerFallback(file, token, safeImageName(index, normalizeListingImageType(file))));
  }

  return {
    imageUrls: urls,
    imageVariants: []
  };
}

async function uploadOriginalsForServerConversion(files: File[], token: string, userId: string) {
  const originals: Array<{ path: string; order: number }> = [];
  let failedIndex: number | undefined;

  try {
    for (const [index, file] of files.entries()) {
      const path = createListingOriginalPath(userId, index, file);
      originals.push({ path, order: index });
      try {
        await upload(LISTING_IMAGE_ORIGINALS_BUCKET, path, file);
      } catch (error) {
        failedIndex = index;
        throw new Error(getTemporaryOriginalUploadErrorMessage(error));
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

    warnUploadFallback("server-convert", files, error, failedIndex);
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
  const processedImages: Awaited<ReturnType<typeof processListingImage>>[] = [];
  let processFailedIndex: number | undefined;

  try {
    for (const [index, file] of acceptedFiles.entries()) {
      processFailedIndex = index;
      processedImages.push(await processListingImage(file, watermark));
    }
    processFailedIndex = undefined;
  } catch (error) {
    if (!isImageProcessingFailure(error)) {
      throw error;
    }

    warnUploadFallback("process", acceptedFiles, error, processFailedIndex);
    if (canUploadOriginalsThroughServerFallback(acceptedFiles)) {
      try {
        return await uploadOriginalsThroughServerFallback(acceptedFiles, token);
      } catch (serverUploadError) {
        warnUploadFallback("processed-server-upload", acceptedFiles, serverUploadError, processFailedIndex);
      }
    }

    try {
      return await uploadOriginalsForServerConversion(acceptedFiles, token, userId);
    } catch (conversionError) {
      warnUploadFallback("server-convert", acceptedFiles, conversionError, processFailedIndex);
      throw conversionError;
    }
  }

  const directUploadedPaths: string[] = [];
  let directUploadFailedIndex: number | undefined;

  try {
    const imageVariants: ListingImageVariant[] = [];

    for (const [index, optimized] of processedImages.entries()) {
      directUploadFailedIndex = index;
      const imageId = crypto.randomUUID();
      const heroPath = `${userId}/${imageId}-${index}-hero.webp`;
      const cardPath = `${userId}/${imageId}-${index}-card.webp`;

      await upload("listing-images", heroPath, optimized.hero);
      directUploadedPaths.push(heroPath);
      await upload("listing-images", cardPath, optimized.card);
      directUploadedPaths.push(cardPath);

      imageVariants.push({
        heroUrl: supabase.storage.from("listing-images").getPublicUrl(heroPath).data.publicUrl,
        cardUrl: supabase.storage.from("listing-images").getPublicUrl(cardPath).data.publicUrl,
        blurDataUrl: optimized.blurDataUrl,
        width: optimized.width,
        height: optimized.height,
        cardWidth: optimized.cardWidth,
        cardHeight: optimized.cardHeight,
        order: index
      });
    }

    return {
      imageUrls: imageVariants.map((image) => image.heroUrl),
      imageVariants
    };
  } catch (error) {
    if (!isOptimizedUploadFallbackCandidate(error)) {
      throw error;
    }

    if (directUploadedPaths.length) {
      await supabase.storage.from("listing-images").remove(directUploadedPaths).catch(() => undefined);
    }

    warnUploadFallback("optimized-upload", acceptedFiles, error, directUploadFailedIndex);
    try {
      const fallbackVariants: ListingImageVariant[] = [];

      for (const [index, optimized] of processedImages.entries()) {
        const heroUrl = await uploadViaServerFallback(optimized.hero, token, `listing-image-${index + 1}-hero.webp`);
        const cardUrl = await uploadViaServerFallback(optimized.card, token, `listing-image-${index + 1}-card.webp`);

        fallbackVariants.push({
          heroUrl,
          cardUrl,
          blurDataUrl: optimized.blurDataUrl,
          width: optimized.width,
          height: optimized.height,
          cardWidth: optimized.cardWidth,
          cardHeight: optimized.cardHeight,
          order: index
        });
      }

      return {
        imageUrls: fallbackVariants.map((image) => image.heroUrl),
        imageVariants: fallbackVariants
      };
    } catch (serverUploadError) {
      warnUploadFallback("processed-server-upload", acceptedFiles, serverUploadError, directUploadFailedIndex);
      throw serverUploadError;
    }
  }
}
