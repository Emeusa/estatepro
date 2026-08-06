import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAgent } from "@/lib/auth";
import {
  BROWSER_PROCESSABLE_LISTING_IMAGE_TYPES,
  getListingImageExtensionForType,
  MAX_LISTING_FINAL_IMAGE_BYTES,
  MAX_LISTING_FINAL_IMAGE_MB,
  normalizeListingImageType,
  SUPPORTED_LISTING_IMAGE_LABEL
} from "@/lib/image-limits";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getListingImageUploadBlockReason } from "@/lib/upload-permissions";

type UploadErrorCode =
  | "UPLOAD_SESSION_EXPIRED"
  | "UPLOAD_AGENT_BLOCKED"
  | "UPLOAD_FILE_TYPE_INVALID"
  | "UPLOAD_FINAL_SIZE_EXCEEDED"
  | "UPLOAD_STORAGE_FAILED"
  | "UPLOAD_FILE_MISSING";

function jsonError(message: string, status: number, code: UploadErrorCode) {
  return NextResponse.json({ message, code }, { status });
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const decoded = await requireAgent(request);
    userId = decoded.uid;

    const supabase = createServerSupabaseClient();
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("verification_status, is_blocked")
      .eq("id", decoded.uid)
      .single();

    const blockReason = getListingImageUploadBlockReason(agentError ? null : agent);
    if (blockReason) {
      return jsonError(blockReason, 403, "UPLOAD_AGENT_BLOCKED");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("No image file was provided.", 400, "UPLOAD_FILE_MISSING");
    }

    const normalizedType = normalizeListingImageType(file);
    if (
      !normalizedType ||
      !BROWSER_PROCESSABLE_LISTING_IMAGE_TYPES.includes(normalizedType as (typeof BROWSER_PROCESSABLE_LISTING_IMAGE_TYPES)[number])
    ) {
      return jsonError(
        `This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`,
        400,
        "UPLOAD_FILE_TYPE_INVALID"
      );
    }

    if (file.size <= 0 || file.size > MAX_LISTING_FINAL_IMAGE_BYTES) {
      return jsonError(
        `Each processed image must be ${MAX_LISTING_FINAL_IMAGE_MB} MB or less.`,
        400,
        "UPLOAD_FINAL_SIZE_EXCEEDED"
      );
    }

    const extension = getListingImageExtensionForType(normalizedType);
    const path = `${decoded.uid}/${randomUUID()}-server.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("listing-images").upload(path, bytes, {
      cacheControl: "31536000",
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

    return NextResponse.json({ url });
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
      if (error.status === 401) {
        return jsonError("Your session expired. Log in again before uploading images.", error.status, "UPLOAD_SESSION_EXPIRED");
      }

      return jsonError("Only active agent accounts can upload listing images.", error.status, "UPLOAD_AGENT_BLOCKED");
    }

    return jsonError(
      "Server image upload failed. Please try again or choose fewer photos. Upload code: SERVER_IMAGE_UPLOAD_FAILED",
      500,
      "UPLOAD_STORAGE_FAILED"
    );
  }
}
