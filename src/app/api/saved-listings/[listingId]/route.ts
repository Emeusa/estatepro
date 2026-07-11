import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { removeSavedListing } from "@/modules/saved-listings/saved-listing.service";

type Props = {
  params: Promise<{ listingId: string }>;
};

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAuth(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { listingId } = await params;
    const parsedListingId = z.string().uuid().parse(listingId);
    await removeSavedListing(decoded.uid, parsedListingId);

    return withRateLimitHeaders(NextResponse.json({ saved: false }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/saved-listings/[listingId]", method: "DELETE" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not remove saved listing." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
