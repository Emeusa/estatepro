import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAgentDisplayName } from "@/lib/agent-display";
import { AuthError, requireAgent } from "@/lib/auth";
import {
  MAX_LISTING_IMAGES,
  MAX_LISTING_ORIGINAL_IMAGE_BYTES,
  MAX_LISTING_ORIGINAL_IMAGE_MB,
  normalizeListingImageType,
  SUPPORTED_LISTING_IMAGE_LABEL
} from "@/lib/image-limits";
import { getListingOriginalPathBlockReason, LISTING_IMAGE_ORIGINALS_BUCKET } from "@/lib/listing-image-originals";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { processListingImageOnServer } from "@/lib/server/listing-image-processor";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEffectivePlanSlug } from "@/lib/subscriptions";
import { toSubscriptionRecord } from "@/lib/supabase-mappers";
import { getListingImageUploadBlockReason } from "@/lib/upload-permissions";

export const runtime = "nodejs";

const convertSchema = z
  .object({
    originals: z
      .array(
        z
          .object({
            path: z.string().min(8).max(260),
            order: z.number().int().min(0).max(MAX_LISTING_IMAGES - 1)
          })
          .strict()
      )
      .min(1)
      .max(MAX_LISTING_IMAGES)
  })
  .strict();

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

async function getServerWatermark(supabase: ReturnType<typeof createServerSupabaseClient>, agentId: string) {
  const [{ data: user }, { data: agent }, { data: subscription }] = await Promise.all([
    supabase.from("users").select("full_name").eq("id", agentId).single(),
    supabase.from("agents").select("business_name").eq("id", agentId).single(),
    supabase.from("subscriptions").select("*").eq("agent_id", agentId).single()
  ]);
  const planSlug = subscription ? getEffectivePlanSlug(toSubscriptionRecord(subscription)) : "free_starter";

  if (planSlug === "pro_agent" || planSlug === "agency_plus") {
    return {
      type: "agent" as const,
      text: getAgentDisplayName(user?.full_name ?? "Verified Agent", agent?.business_name ?? null)
    };
  }

  return { type: "platform" as const };
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  const uploadedFinalPaths: string[] = [];
  let originalPaths: string[] = [];

  try {
    const decoded = await requireAgent(request);
    userId = decoded.uid;

    const limited = await rateLimit(request, RATE_LIMITS.imageUpload, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const body = convertSchema.parse(await request.json());
    originalPaths = body.originals.map((original) => original.path);

    for (const original of body.originals) {
      const blockReason = getListingOriginalPathBlockReason(decoded.uid, original.path);
      if (blockReason) {
        return jsonError(blockReason, 400);
      }
    }

    const supabase = createServerSupabaseClient();
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("verification_status, is_blocked")
      .eq("id", decoded.uid)
      .single();
    const blockReason = getListingImageUploadBlockReason(agentError ? null : agent);

    if (blockReason) {
      await supabase.storage.from(LISTING_IMAGE_ORIGINALS_BUCKET).remove(originalPaths);
      return jsonError(blockReason, 403);
    }

    const watermark = await getServerWatermark(supabase, decoded.uid);
    const variants = [];

    for (const original of body.originals.sort((first, second) => first.order - second.order)) {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(LISTING_IMAGE_ORIGINALS_BUCKET)
        .download(original.path);

      if (downloadError || !blob) {
        throw new Error(downloadError?.message ?? "Could not read temporary original image.");
      }

      if (blob.size <= 0 || blob.size > MAX_LISTING_ORIGINAL_IMAGE_BYTES) {
        await supabase.storage.from(LISTING_IMAGE_ORIGINALS_BUCKET).remove(originalPaths);
        return jsonError(`Each image must be ${MAX_LISTING_ORIGINAL_IMAGE_MB} MB or less before compression.`, 400);
      }

      const normalizedType = normalizeListingImageType({ name: original.path, type: blob.type });
      if (!normalizedType) {
        await supabase.storage.from(LISTING_IMAGE_ORIGINALS_BUCKET).remove(originalPaths);
        return jsonError(`This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`, 400);
      }

      const processed = await processListingImageOnServer(Buffer.from(await blob.arrayBuffer()), normalizedType, watermark);
      const imageId = randomUUID();
      const heroPath = `${decoded.uid}/${imageId}-${original.order}-hero.webp`;
      const cardPath = `${decoded.uid}/${imageId}-${original.order}-card.webp`;

      const { error: heroUploadError } = await supabase.storage.from("listing-images").upload(heroPath, processed.hero.buffer, {
        contentType: "image/webp",
        upsert: false
      });
      if (heroUploadError) {
        throw heroUploadError;
      }
      uploadedFinalPaths.push(heroPath);

      const { error: cardUploadError } = await supabase.storage.from("listing-images").upload(cardPath, processed.card.buffer, {
        contentType: "image/webp",
        upsert: false
      });
      if (cardUploadError) {
        throw cardUploadError;
      }
      uploadedFinalPaths.push(cardPath);

      variants.push({
        heroUrl: supabase.storage.from("listing-images").getPublicUrl(heroPath).data.publicUrl,
        cardUrl: supabase.storage.from("listing-images").getPublicUrl(cardPath).data.publicUrl,
        blurDataUrl: processed.blurDataUrl,
        width: processed.hero.width,
        height: processed.hero.height,
        cardWidth: processed.card.width,
        cardHeight: processed.card.height,
        order: original.order
      });
    }

    await supabase.storage.from(LISTING_IMAGE_ORIGINALS_BUCKET).remove(originalPaths);
    await logSecurityEvent({
      request,
      action: "listing_image_server_converted",
      result: "success",
      userId: decoded.uid,
      metadata: { count: variants.length }
    });

    return withRateLimitHeaders(
      NextResponse.json({
        imageUrls: variants.map((variant) => variant.heroUrl),
        imageVariants: variants
      }),
      limited.headers
    );
  } catch (error) {
    const supabase = createServerSupabaseClient();

    if (uploadedFinalPaths.length) {
      await supabase.storage.from("listing-images").remove(uploadedFinalPaths);
    }

    if (originalPaths.length) {
      await supabase.storage.from(LISTING_IMAGE_ORIGINALS_BUCKET).remove(originalPaths);
    }

    captureServerError(error, { route: "/api/uploads/listing-images/convert", userId });
    await logSecurityEvent({
      request,
      action: "listing_image_server_converted",
      result: "blocked",
      userId,
      metadata: { reason: error instanceof Error ? error.message : "unknown" }
    });

    if (error instanceof AuthError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof z.ZodError) {
      return jsonError("Invalid image conversion request.", 400);
    }

    return jsonError("We could not process this phone photo. Try exporting it as JPG and upload again.", 500);
  }
}
