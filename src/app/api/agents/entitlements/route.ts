import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAgent } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getAgentDashboardData } from "@/modules/agents/agent.service";
import { getAgentEntitlements } from "@/modules/entitlements/entitlement.service";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const profile = await getAgentDashboardData(decoded.uid);
    const entitlements = await getAgentEntitlements(decoded.uid, profile.subscription);
    return withRateLimitHeaders(NextResponse.json({ entitlements }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/agents/entitlements" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load entitlements." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
