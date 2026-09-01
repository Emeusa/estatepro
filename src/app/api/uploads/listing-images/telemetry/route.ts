import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAgent } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";

const imageFailureTelemetrySchema = z.object({
  stage: z.literal("browser-compress"),
  code: z.literal("IMAGE_COMPRESS_FAILED"),
  imageCount: z.number().int().min(1).max(15),
  mimeTypes: z.array(z.string().max(80)).max(8),
  sizeBuckets: z
    .array(z.enum(["under_1mb", "1_to_4mb", "4_to_8mb", "8_to_15mb", "15_to_20mb"]))
    .min(1)
    .max(15),
  failedIndex: z.number().int().min(0).max(14),
  deviceClass: z.enum(["ios", "android", "desktop", "unknown"])
}).strict();

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAgent(request);
    const payload = imageFailureTelemetrySchema.parse(await request.json());

    await logSecurityEvent({
      request,
      action: "listing_image_client_processing",
      result: "failed",
      userId: decoded.uid,
      metadata: payload
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid image telemetry payload." }, { status: 400 });
    }

    if (error instanceof AuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    captureServerError(error, { route: "/api/uploads/listing-images/telemetry" });
    return NextResponse.json({ message: "Could not record image diagnostics." }, { status: 500 });
  }
}
