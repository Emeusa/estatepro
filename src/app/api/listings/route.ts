import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAgent } from "@/lib/auth";
import { MAX_LISTING_IMAGES } from "@/lib/image-limits";
import { assertBotProtection, botProtectionSchema } from "@/lib/security/bot";
import { captureServerError } from "@/lib/security/logger";
import { getAgentDailyListingLimit } from "@/lib/security/quotas";
import { RATE_LIMITS, rateLimitByIp, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { createAgentListing, getPublicListings } from "@/modules/listings/listing.service";

function mapListingErrors(error: ZodError) {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path === "title") {
      fields.title = "Title must be at least 8 characters.";
    } else if (path === "description") {
      fields.description = "Description must be at least 20 characters.";
    } else if (path.startsWith("imageUrls") || path.startsWith("imageVariants")) {
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
    } else if (
      [
        "bedrooms",
        "bathrooms",
        "toilets",
        "parkingSpaces",
        "propertySize",
        "yearBuilt",
        "floorLevel",
        "totalFloors",
        "landSize"
      ].includes(path)
    ) {
      fields.quality = "Enter valid optional property details.";
    } else if (
      [
        "propertySizeUnit",
        "landSizeUnit",
        "furnishingStatus",
        "servicingStatus",
        "propertyCondition",
        "titleDocumentType",
        "zoningType",
        "roadAccess"
      ].includes(path)
    ) {
      fields.quality = "Select valid optional property detail options.";
    } else if (
      ["amenities", "utilities", "safetyFeatures", "nearbyLandmarks", "extraFeatures"].includes(path)
    ) {
      fields.quality = "Enter no more than 30 short items per feature list.";
    }
  }

  return fields;
}

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
    await assertBotProtection(request, botProtectionSchema.parse(body), "listing_create", decoded.uid);
    const { website, formStartedAt, turnstileToken, ...listingInput } = body as Record<string, unknown>;
    void website;
    void formStartedAt;
    void turnstileToken;
    const listing = await createAgentListing(decoded.uid, listingInput);

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
