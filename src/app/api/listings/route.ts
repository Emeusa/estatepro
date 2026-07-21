import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAgent } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { getAgentDailyListingLimit } from "@/lib/security/quotas";
import { RATE_LIMITS, rateLimitByIp, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { mapListingErrors } from "@/modules/listings/listing-error-mapper";
import { createAgentListing, getPublicListings } from "@/modules/listings/listing.service";

export async function GET(request: NextRequest) {
  try {
    const limited = await rateLimitByIp(request, RATE_LIMITS.publicRead);
    if (!limited.allowed) {
      return limited.response;
    }

    const searchParams = request.nextUrl.searchParams;
    const data = await getPublicListings({
      keyword: searchParams.get("q") ?? undefined,
      location: searchParams.get("location") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      city: searchParams.get("city") ?? undefined,
      minPrice: searchParams.get("minPrice") ?? undefined,
      maxPrice: searchParams.get("maxPrice") ?? undefined,
      bedrooms: searchParams.get("bedrooms") ?? undefined,
      bathrooms: searchParams.get("bathrooms") ?? undefined,
      propertyType: searchParams.get("propertyType") ?? undefined,
      listingCategory: searchParams.get("listingCategory") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined
    });

    return withRateLimitHeaders(NextResponse.json(data), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/listings", method: "GET" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load listings." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAgent(request);
    const dailyLimit = await getAgentDailyListingLimit(decoded.uid);
    const limited = await rateLimit(
      request,
      { ...RATE_LIMITS.listingCreate, limit: dailyLimit },
      decoded.uid,
      decoded.uid
    );
    if (!limited.allowed) {
      return limited.response;
    }

    const body = await request.json();
    const listing = await createAgentListing(decoded.uid, body);

    return withRateLimitHeaders(NextResponse.json({ listing }, { status: 201 }), limited.headers);
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
      { message: error instanceof Error ? error.message : "Could not create listing." },
      { status: 400 }
    );
  }
}
