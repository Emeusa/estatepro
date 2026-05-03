import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAuth, requireRole } from "@/lib/auth";
import { createAgentListing, getPublicListings } from "@/modules/listings/listing.service";

function mapListingErrors(error: ZodError) {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path === "title") {
      fields.title = "Title must be at least 8 characters.";
    } else if (path === "description") {
      fields.description = "Description must be at least 20 characters.";
    } else if (path === "imageUrls") {
      fields.images = "Upload at least one property image.";
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const data = await getPublicListings({
      location: searchParams.get("location") ?? undefined,
      maxPrice: searchParams.get("maxPrice") ?? undefined,
      propertyType: searchParams.get("propertyType") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load listings." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    requireRole(decoded, "agent");

    const body = await request.json();
    const listing = await createAgentListing(decoded.uid, body);

    return NextResponse.json({ listing }, { status: 201 });
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
