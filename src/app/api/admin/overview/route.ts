import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getAgentReviewsForAdmin, getPaidPlanStatsForAdmin } from "@/modules/agents/agent.service";
import { listSupportRequestsForAdmin } from "@/modules/support/support.service";
import { getReportStatsForAdmin, listAdminNotifications } from "@/modules/reports/report.service";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const [agents, supportRequests, paidPlanStats, reportStats, notifications] = await Promise.all([
      getAgentReviewsForAdmin(),
      listSupportRequestsForAdmin(12),
      getPaidPlanStatsForAdmin(),
      getReportStatsForAdmin(),
      listAdminNotifications(8)
    ]);

    return withRateLimitHeaders(
      NextResponse.json({ agents, supportRequests, paidPlanStats, reportStats, notifications }),
      limited.headers
    );
  } catch (error) {
    captureServerError(error, { route: "/api/admin/overview" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load admin overview." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
