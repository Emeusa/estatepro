import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError, requireAgent } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import {
  reactivateAgentListing,
  setAgentListingKeepActivePreference
} from "@/modules/listings/listing.service";
import { listingRetentionActionSchema } from "@/modules/listings/listing.schema";

type Props = {
  params: Promise<{ listingId: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { listingId } = await params;
    const body = listingRetentionActionSchema.parse(await request.json());
    const listing =
      body.action === "reactivate"
        ? await reactivateAgentListing(decoded.uid, listingId)
        : await setAgentListingKeepActivePreference(decoded.uid, listingId, body.action === "keep_active");

    return withRateLimitHeaders(NextResponse.json({ listing }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/listings/[listingId]/retention" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update listing retention settings." },
      { status: error instanceof AuthError ? error.status : error instanceof ZodError ? 400 : 400 }
    );
  }
}
