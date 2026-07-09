import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError, requireAgent } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { applyListingPromotion } from "@/modules/promotions/promotion.service";

type Props = {
  params: Promise<{ listingId: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { listingId } = await params;
    const result = await applyListingPromotion(decoded.uid, listingId, await request.json());

    await logSecurityEvent({
      request,
      action: "listing_promotion_applied",
      result: "success",
      userId: decoded.uid,
      metadata: { listingId }
    });

    return withRateLimitHeaders(NextResponse.json(result), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/listings/[listingId]/promotions" });
    const status = error instanceof AuthError ? error.status : error instanceof ZodError ? 400 : 400;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not promote listing." },
      { status }
    );
  }
}
