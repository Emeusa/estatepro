import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError, requireAgent } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, rateLimitByIp, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { mapListingErrors, mapListingRuntimeError, summarizeListingImageIssues } from "@/modules/listings/listing-error-mapper";
import { revalidateListingMutationPaths } from "@/modules/listings/listing-cache";
import {
  ensureAgentOwnsListing,
  getPublicListingDetails,
  removeAgentListing,
  updateAgentListing
} from "@/modules/listings/listing.service";

type Props = {
  params: Promise<{ listingId: string }>;
};

export async function GET(_: NextRequest, { params }: Props) {
  const request = _;
  const limited = await rateLimitByIp(request, RATE_LIMITS.publicRead);
  if (!limited.allowed) {
    return limited.response;
  }

  const { listingId } = await params;
  const listing = await getPublicListingDetails(listingId);
  if (!listing) {
    return withRateLimitHeaders(
      NextResponse.json({ message: "Listing not found." }, { status: 404 }),
      limited.headers
    );
  }
  return withRateLimitHeaders(NextResponse.json({ listing }), limited.headers);
}

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }
    const { listingId } = await params;
    const previousListing = await ensureAgentOwnsListing(decoded.uid, listingId);
    const body = await request.json();
    const listing = await updateAgentListing(decoded.uid, listingId, body);
    revalidateListingMutationPaths(listing, previousListing);
    return withRateLimitHeaders(NextResponse.json({ listing }), limited.headers);
  } catch (error) {
    if (error instanceof ZodError) {
      captureServerError(error, {
        route: "/api/listings/[listingId]",
        method: "PATCH",
        imageValidationIssues: summarizeListingImageIssues(error)
      });
      return NextResponse.json(
        {
          message: "Please correct the highlighted fields.",
          fields: mapListingErrors(error)
        },
        { status: 400 }
      );
    }

    const mappedError = mapListingRuntimeError(error);
    if (mappedError) {
      return NextResponse.json(mappedError, { status: 400 });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update listing." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }
    const { listingId } = await params;
    const listing = await ensureAgentOwnsListing(decoded.uid, listingId);
    await removeAgentListing(decoded.uid, listingId);
    revalidateListingMutationPaths(listing);
    await logSecurityEvent({
      request,
      action: "listing_delete",
      result: "success",
      userId: decoded.uid,
      metadata: { listingId }
    });
    return withRateLimitHeaders(NextResponse.json({ ok: true }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/listings/[listingId]", method: "DELETE" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not delete listing." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
