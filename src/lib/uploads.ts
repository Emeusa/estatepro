"use client";

import { getAgentDisplayName } from "@/lib/agent-display";
import { apiRequest } from "@/lib/api";
import { processListingImage, type ListingImageWatermark } from "@/lib/image";
import {
  getListingImageExtensionForType,
  getListingImageFormatErrorMessage,
  getListingImageCountLimitMessage,
  isSupportedListingImageFile,
  MAX_LISTING_FINAL_IMAGE_BYTES,
  MAX_LISTING_FINAL_IMAGE_MB,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGE_MB,
  normalizeListingImageType,
  SUPPORTED_LISTING_IMAGE_LABEL
} from "@/lib/image-limits";
import { supabase } from "@/lib/supabase/client";
import { getEffectivePlanSlug } from "@/lib/subscriptions";
import type { ListingImageVariant, SubscriptionRecord } from "@/lib/types";

type ListingImageUploadResult = {
  imageUrls: string[];
  imageVariants: ListingImageVariant[];
};

type UploadStage = "authorize" | "browser-compress" | "direct-final-upload" | "server-final-upload";

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

const SERVER_IMAGE_UPLOAD_FAILED_MESSAGE =
  "Server image upload failed. Please try again or choose fewer photos. Upload code: SERVER_IMAGE_UPLOAD_FAILED";
const IMAGE_COMPRESS_FAILED_MESSAGE =
  "Image could not be compressed on this phone. Try JPG or upload fewer photos. Upload code: IMAGE_COMPRESS_FAILED";
const SERVER_UPLOAD_RESPONSE_FAILED_MESSAGE =
  "Server upload completed without an image URL. Try again with fewer photos. Upload code: SERVER_UPLOAD_RESPONSE_MISSING";

async function requireUserId() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error("You must be logged in before uploading files.");
  }

  return session.user.id;
}

async function uploadViaServer(file: Blob, token: string, filename: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
      if (attempt === 0) {
        continue;
      }
      throw new Error(SERVER_IMAGE_UPLOAD_FAILED_MESSAGE);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body.message ?? SERVER_IMAGE_UPLOAD_FAILED_MESSAGE;
      if (response.status >= 500 && attempt === 0) {
        continue;
      }
      throw new Error(message);
    }

    const body = (await response.json()) as { url?: string };
    if (!body.url) {
      throw new Error(SERVER_UPLOAD_RESPONSE_FAILED_MESSAGE);
    }

    return body.url;
  }

  throw new Error(SERVER_IMAGE_UPLOAD_FAILED_MESSAGE);
}

async function uploadDirectFinalImage(file: File, userId: string, filename: string) {
  const path = `${userId}/${crypto.randomUUID()}-${filename}`;
  const { error } = await supabase.storage.from("listing-images").upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(`Direct storage upload failed. ${error.message} Upload code: DIRECT_STORAGE_UPLOAD_FAILED`);
  }

  return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
}

async function uploadFinalImage(file: File, token: string, userId: string, filename: string, allFiles: File[], order: number) {
  if (file.size <= 0 || file.size > MAX_LISTING_FINAL_IMAGE_BYTES) {
    throw new Error(`Each processed image must be ${MAX_LISTING_FINAL_IMAGE_MB} MB or less.`);
  }

  try {
    return await uploadDirectFinalImage(file, userId, filename);
  } catch (error) {
    warnUploadStage("direct-final-upload", allFiles, error, order);
    return await uploadViaServer(file, token, filename);
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

function safeImageName(index: number, type: ReturnType<typeof normalizeListingImageType>, suffix: "hero" | "card") {
  if (!type) {
    throw new Error(`This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`);
  }

  return `listing-image-${index + 1}-${suffix}.${getListingImageExtensionForType(type)}`;
}

export function normalizeListingImageFile(file: File, index: number) {
  const formatError = getListingImageFormatErrorMessage(file);
  const normalizedType = normalizeListingImageType(file);

  if (formatError || !normalizedType) {
    throw new Error(formatError ?? `This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`);
  }

  const extension = getListingImageExtensionForType(normalizedType);
  const normalizedName = `listing-image-${index + 1}.${extension}`;
  if (file.type === normalizedType && file.name.toLowerCase().endsWith(`.${extension}`)) {
    return file;
  }

  return new File([file], normalizedName, {
    type: normalizedType,
    lastModified: file.lastModified
  });
}

function warnUploadStage(stage: UploadStage, files: File[], error: unknown, failedIndex?: number) {
  console.warn("Listing image upload stage failed.", {
    stage,
    count: files.length,
    types: files.map((file) => file.type),
    sizes: files.map((file) => file.size),
    failedIndex,
    reason: error instanceof Error ? error.message : "unknown"
  });
}

async function uploadBrowserProcessedImage(
  file: File,
  token: string,
  userId: string,
  watermark: ListingImageWatermark,
  order: number,
  allFiles: File[]
): Promise<{ imageUrl: string; imageVariant: ListingImageVariant }> {
  let optimized: Awaited<ReturnType<typeof processListingImage>>;
  try {
    optimized = await processListingImage(file, watermark);
  } catch (error) {
    warnUploadStage("browser-compress", allFiles, error, order);
    throw new Error(IMAGE_COMPRESS_FAILED_MESSAGE);
  }

  try {
    const heroType = normalizeListingImageType(optimized.hero);
    const cardType = normalizeListingImageType(optimized.card);
    const heroUrl = await uploadFinalImage(
      optimized.hero,
      token,
      userId,
      safeImageName(order, heroType, "hero"),
      allFiles,
      order
    );
    const cardUrl = await uploadFinalImage(
      optimized.card,
      token,
      userId,
      safeImageName(order, cardType, "card"),
      allFiles,
      order
    );

    return {
      imageUrl: heroUrl,
      imageVariant: {
        heroUrl,
        cardUrl,
        blurDataUrl: optimized.blurDataUrl,
        width: optimized.width,
        height: optimized.height,
        cardWidth: optimized.cardWidth,
        cardHeight: optimized.cardHeight,
        order
      }
    };
  } catch (error) {
    warnUploadStage("server-final-upload", allFiles, error, order);
    throw error;
  }
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
    warnUploadStage("authorize", acceptedFiles, error);
    throw error;
  }

  const watermark = await getListingImageWatermark(token);
  const imageUrls: string[] = [];
  const imageVariants: ListingImageVariant[] = [];

  for (const [index, file] of acceptedFiles.entries()) {
    const uploaded = await uploadBrowserProcessedImage(file, token, userId, watermark, index, acceptedFiles);
    imageUrls.push(uploaded.imageUrl);
    imageVariants.push(uploaded.imageVariant);
  }

  return {
    imageUrls,
    imageVariants
  };
}
