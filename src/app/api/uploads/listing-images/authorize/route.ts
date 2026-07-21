import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAgent } from "@/lib/auth";
import {
  MAX_LISTING_ORIGINAL_IMAGE_BYTES,
  MAX_LISTING_IMAGES,
  SUPPORTED_LISTING_IMAGE_TYPES
} from "@/lib/image-limits";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";

const allowedExtensions = [".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".webp", ".heic", ".heif", ".avif"];

const imageMetadataSchema = z.object({
  name: z.string().min(1).max(180),
  size: z.number().int().positive().max(MAX_LISTING_ORIGINAL_IMAGE_BYTES),
  type: z.enum(SUPPORTED_LISTING_IMAGE_TYPES)
}).strict().refine(
  (file) => allowedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension)),
  "Image extension must match JPG, PNG, or WebP."
);

const authorizeSchema = z.object({
  files: z.array(imageMetadataSchema).min(1).max(MAX_LISTING_IMAGES)
}).strict();

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const decoded = await requireAgent(request);
    userId = decoded.uid;

    const body = authorizeSchema.parse(await request.json());
    await logSecurityEvent({
      request,
      action: "listing_image_upload_authorized",
      result: "success",
      userId: decoded.uid,
      metadata: { count: body.files.length }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureServerError(error, { route: "/api/uploads/listing-images/authorize", userId });
    await logSecurityEvent({
      request,
      action: "listing_image_upload_authorized",
      result: "blocked",
      userId,
      metadata: { reason: error instanceof Error ? error.message : "unknown" }
    });
    return NextResponse.json(
      { message: "These images could not be accepted. Use JPG, PNG, WebP, HEIC/HEIF, or AVIF files under 15 MB." },
      { status: 400 }
    );
  }
}
