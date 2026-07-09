import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAgent } from "@/lib/auth";
import { isBillingLiveEnabled } from "@/lib/billing-config";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getAgentAnalytics } from "@/modules/analytics/analytics.service";
import { getAgentDashboardData, getUserAccount } from "@/modules/agents/agent.service";
import { getAgentEntitlements } from "@/modules/entitlements/entitlement.service";
import { getAgentListings } from "@/modules/listings/listing.service";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const [profile, listings, user] = await Promise.all([
      getAgentDashboardData(decoded.uid),
      getAgentListings(decoded.uid),
      getUserAccount(decoded.uid)
    ]);
    const [entitlements, analytics] = await Promise.all([
      getAgentEntitlements(decoded.uid, profile.subscription),
      getAgentAnalytics(decoded.uid, "30d")
    ]);

    return withRateLimitHeaders(
      NextResponse.json({
        profile,
        listings,
        user,
        entitlements,
        analytics,
        billing: {
          liveEnabled: isBillingLiveEnabled()
        }
      }),
      limited.headers
    );
  } catch (error) {
    captureServerError(error, { route: "/api/agents/me" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load agent data." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
