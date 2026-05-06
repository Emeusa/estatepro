import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/lib/auth";
import { updateListing } from "@/modules/listings/listing.repository";
import { listingModerationSchema } from "@/modules/listings/listing.schema";

type Props = {
  params: Promise<{ listingId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAuth(request);
    requireRole(decoded, "admin");
    const body = listingModerationSchema.parse(await request.json());
    const { listingId } = await params;
    const listing = await updateListing(listingId, { status: body.status });
    return NextResponse.json({ listing });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not moderate listing." },
      { status: 400 }
    );
  }
}
