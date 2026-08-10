import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getAdminListingRanking } from "@/modules/listings/listing.service";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) return limited.response;

    const searchParams = request.nextUrl.searchParams;
    const ranking = await getAdminListingRanking({
      keyword: searchParams.get("q") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      city: searchParams.get("city") ?? undefined,
      areaSlug: searchParams.get("areaSlug") ?? undefined,
      propertyType: searchParams.get("propertyType") ?? undefined,
      propertySubtype: searchParams.get("propertySubtype") ?? undefined,
      listingCategory: searchParams.get("listingCategory") ?? undefined,
      minPrice: searchParams.get("minPrice") ?? undefined,
      maxPrice: searchParams.get("maxPrice") ?? undefined,
      bedrooms: searchParams.get("bedrooms") ?? undefined,
      bathrooms: searchParams.get("bathrooms") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: 10
    });
    const response = NextResponse.json(ranking);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return withRateLimitHeaders(response, limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/admin/ranking", method: "GET" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load listing ranking." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
