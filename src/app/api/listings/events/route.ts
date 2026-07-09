import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getClientIp, hashIp } from "@/lib/security/request";
import { RATE_LIMITS, rateLimitByIp, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { recordListingEvent } from "@/modules/analytics/analytics.service";

const listingEventSchema = z.object({
  listingId: z.string().uuid(),
  eventType: z.enum(["impression", "detail_view", "whatsapp_click", "phone_click"]),
  sessionId: z.string().trim().max(120).optional()
});

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, RATE_LIMITS.publicRead);
  if (!limited.allowed) {
    return limited.response;
  }

  try {
    const body = listingEventSchema.parse(await request.json());
    await recordListingEvent({
      listingId: body.listingId,
      eventType: body.eventType,
      sessionId: body.sessionId,
      ipHash: hashIp(getClientIp(request))
    });

    return withRateLimitHeaders(NextResponse.json({ ok: true }), limited.headers);
  } catch {
    // Analytics failures must not disrupt public browsing.
    return withRateLimitHeaders(NextResponse.json({ ok: false }, { status: 202 }), limited.headers);
  }
}
