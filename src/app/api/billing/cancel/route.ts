import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAgent } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { cancelAgentSubscription } from "@/modules/billing/billing.service";

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const subscription = await cancelAgentSubscription(decoded.uid);
    await logSecurityEvent({
      request,
      action: "billing_subscription_cancelled",
      result: "success",
      userId: decoded.uid,
      metadata: { planSlug: subscription.planSlug }
    });

    return withRateLimitHeaders(NextResponse.json({ subscription }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/billing/cancel" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not cancel subscription." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
