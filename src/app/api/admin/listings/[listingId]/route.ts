import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { updateListing } from "@/modules/listings/listing.repository";
import { listingModerationSchema } from "@/modules/listings/listing.schema";

type Props = {
  params: Promise<{ listingId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }
    const body = listingModerationSchema.parse(await request.json());
    const { listingId } = await params;
    const listing = await updateListing(listingId, { status: body.status });
    await logSecurityEvent({
      request,
      action: "listing_moderation_change",
      result: "success",
      userId: decoded.uid,
      metadata: { listingId, status: body.status }
    });
    return withRateLimitHeaders(NextResponse.json({ listing }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/admin/listings/[listingId]" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not moderate listing." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
