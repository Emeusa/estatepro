import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError, requireAgent } from "@/lib/auth";
import { MAX_LISTING_IMAGES } from "@/lib/image-limits";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, rateLimitByIp, withRateLimitHeaders } from "@/lib/security/rate-limit";
import {
  ensureAgentOwnsListing,
  getPublicListingDetails,
  removeAgentListing,
  updateAgentListing
} from "@/modules/listings/listing.service";

function mapListingErrors(error: ZodError) {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path === "title") {
      fields.title = "Title must be at least 8 characters.";
    } else if (path === "description") {
      fields.description = "Description must be at least 20 characters.";
    } else if (path.startsWith("imageUrls")) {
      fields.images =
        issue.code === "too_small"
          ? "Upload at least one property image."
          : issue.code === "too_big"
            ? `Upload no more than ${MAX_LISTING_IMAGES} property images.`
          : "Images must be uploaded through this platform.";
    } else if (path === "price") {
      fields.price = "Enter a valid property price.";
    } else if (path === "contactPhone") {
      fields.contactPhone = "Enter a valid contact phone number.";
    } else if (path === "contactWhatsapp") {
      fields.contactWhatsapp = "Enter a valid WhatsApp number.";
    } else if (path === "location.state") {
      fields.state = "Enter a valid state.";
    } else if (path === "location.city") {
      fields.city = "Enter a valid city.";
    } else if (path === "location.area") {
      fields.area = "Enter a valid area.";
    }
  }

  return fields;
}

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
    await ensureAgentOwnsListing(decoded.uid, listingId);
    const body = await request.json();
    const listing = await updateAgentListing(decoded.uid, listingId, body);
    return withRateLimitHeaders(NextResponse.json({ listing }), limited.headers);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Please correct the highlighted fields.",
          fields: mapListingErrors(error)
        },
        { status: 400 }
      );
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
    await ensureAgentOwnsListing(decoded.uid, listingId);
    await removeAgentListing(decoded.uid, listingId);
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
