import { NextRequest, NextResponse } from "next/server";

import { isUuidListingIdentifier } from "@/lib/listing-slugs";
import { getListingHref } from "@/lib/listing-urls";
import { getPublicListingDetails } from "@/modules/listings/listing.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await params;
  if (!isUuidListingIdentifier(listingId)) {
    return NextResponse.json({ message: "Listing not found." }, { status: 404 });
  }

  const details = await getPublicListingDetails(listingId);
  if (!details || details.listing.slug === details.listing.id) {
    return NextResponse.json({ message: "Listing not found." }, { status: 404 });
  }

  return NextResponse.redirect(new URL(getListingHref(details.listing), request.url), 308);
}
