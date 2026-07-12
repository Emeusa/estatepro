import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAgent } from "@/lib/auth";
import {
  getListingImageExtensionForType,
  isUnsupportedHeicImage,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGE_MB,
  normalizeListingImageType,
  SUPPORTED_LISTING_IMAGE_LABEL
} from "@/lib/image-limits";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const decoded = await requireAgent(request);
    userId = decoded.uid;

    const limited = await rateLimit(request, RATE_LIMITS.imageUpload, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const supabase = createServerSupabaseClient();
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("verification_status, is_blocked")
      .eq("id", decoded.uid)
      .single();

    if (agentError || !agent || agent.is_blocked || agent.verification_status !== "approved") {
      return jsonError("Your agent account must be approved and active before uploading listing images.", 403);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("No image file was provided.", 400);
    }

    if (isUnsupportedHeicImage(file)) {
      return jsonError("HEIC images are not supported yet. Please choose JPG, PNG, or WebP.", 400);
    }

    const normalizedType = normalizeListingImageType(file);
    if (!normalizedType) {
      return jsonError(`Only ${SUPPORTED_LISTING_IMAGE_LABEL} images are supported.`, 400);
    }

    if (file.size <= 0 || file.size > MAX_LISTING_IMAGE_BYTES) {
      return jsonError(`Each property image must be ${MAX_LISTING_IMAGE_MB} MB or less.`, 400);
    }

    const extension = getListingImageExtensionForType(normalizedType);
    const path = `${decoded.uid}/${randomUUID()}-server.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("listing-images").upload(path, bytes, {
      contentType: normalizedType,
      upsert: false
    });

    if (uploadError) {
      throw uploadError;
    }

    const url = supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
    await logSecurityEvent({
      request,
      action: "listing_image_server_fallback_uploaded",
      result: "success",
      userId: decoded.uid,
      metadata: { size: file.size, type: normalizedType }
    });

    return withRateLimitHeaders(NextResponse.json({ url }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/uploads/listing-images/fallback", userId });
    await logSecurityEvent({
      request,
      action: "listing_image_server_fallback_uploaded",
      result: "blocked",
      userId,
      metadata: { reason: error instanceof Error ? error.message : "unknown" }
    });

    if (error instanceof AuthError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Image upload failed. Please try again or choose a smaller JPG, PNG, or WebP image.", 500);
  }
}
