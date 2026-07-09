import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAgent } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getAgentAnalytics } from "@/modules/analytics/analytics.service";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const range = request.nextUrl.searchParams.get("range") === "7d" ? "7d" : "30d";
    const analytics = await getAgentAnalytics(decoded.uid, range);
    return withRateLimitHeaders(NextResponse.json({ analytics }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/agents/analytics" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load analytics." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
