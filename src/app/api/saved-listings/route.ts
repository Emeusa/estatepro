import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError, requireAuth } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { savedListingMutationSchema, parseSavedListingIdsParam } from "@/modules/saved-listings/saved-listing.schema";
import { listSavedListingIds, listSavedListings, saveListing } from "@/modules/saved-listings/saved-listing.service";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const requestedListingIds = parseSavedListingIdsParam(request.nextUrl.searchParams.get("listingIds"));
    if (requestedListingIds.length) {
      const savedListingIds = await listSavedListingIds(decoded.uid, requestedListingIds);
      return withRateLimitHeaders(NextResponse.json({ savedListingIds }), limited.headers);
    }

    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const result = await listSavedListings(decoded.uid, Number.isInteger(page) && page > 0 ? page : 1);
    return withRateLimitHeaders(NextResponse.json(result), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/saved-listings", method: "GET" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load saved listings." },
      { status: error instanceof AuthError ? error.status : error instanceof ZodError ? 400 : 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const body = savedListingMutationSchema.parse(await request.json());
    await saveListing(decoded.uid, body.listingId);

    return withRateLimitHeaders(NextResponse.json({ saved: true }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/saved-listings", method: "POST" });
    return NextResponse.json(
      { message: error instanceof ZodError ? "Invalid listing." : error instanceof Error ? error.message : "Could not save listing." },
      { status: error instanceof AuthError ? error.status : error instanceof ZodError ? 400 : 400 }
    );
  }
}
