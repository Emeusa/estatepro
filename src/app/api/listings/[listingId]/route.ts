import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAuth, requireRole } from "@/lib/auth";
import { MAX_LISTING_IMAGES } from "@/lib/image-limits";
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
  const { listingId } = await params;
  const listing = await getPublicListingDetails(listingId);
  if (!listing) {
    return NextResponse.json({ message: "Listing not found." }, { status: 404 });
  }
  return NextResponse.json({ listing });
}

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAuth(request);
    requireRole(decoded, "agent");
    const { listingId } = await params;
    await ensureAgentOwnsListing(decoded.uid, listingId);
    const body = await request.json();
    const listing = await updateAgentListing(decoded.uid, listingId, body);
    return NextResponse.json({ listing });
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
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAuth(request);
    requireRole(decoded, "agent");
    const { listingId } = await params;
    await ensureAgentOwnsListing(decoded.uid, listingId);
    await removeAgentListing(decoded.uid, listingId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not delete listing." },
      { status: 400 }
    );
  }
}
