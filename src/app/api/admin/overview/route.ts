import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import type { AdminOverviewResponse, AdminOverviewSection } from "@/lib/types";
import { getAdminOverviewStats, getPaidPlanStatsForAdmin } from "@/modules/agents/agent.service";
import { listSupportRequestsForAdmin } from "@/modules/support/support.service";
import { getReportStatsForAdmin, listAdminNotifications } from "@/modules/reports/report.service";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const [stats, optionalSections] = await Promise.all([
      getAdminOverviewStats(),
      Promise.allSettled([
        listSupportRequestsForAdmin(12),
        getPaidPlanStatsForAdmin(),
        getReportStatsForAdmin(),
        listAdminNotifications(8)
      ])
    ]);
    const sectionNames: AdminOverviewSection[] = [
      "supportRequests",
      "paidPlanStats",
      "reportStats",
      "notifications"
    ];
    const degradedSections = optionalSections.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return [];
      }

      const section = sectionNames[index];
      captureServerError(result.reason, { route: "/api/admin/overview", section });
      return section ? [section] : [];
    });
    const payload: AdminOverviewResponse = {
      stats,
      supportRequests: optionalSections[0]?.status === "fulfilled" ? optionalSections[0].value : undefined,
      paidPlanStats: optionalSections[1]?.status === "fulfilled" ? optionalSections[1].value : undefined,
      reportStats: optionalSections[2]?.status === "fulfilled" ? optionalSections[2].value : undefined,
      notifications: optionalSections[3]?.status === "fulfilled" ? optionalSections[3].value : undefined,
      degradedSections
    };

    return withRateLimitHeaders(
      NextResponse.json(payload),
      limited.headers
    );
  } catch (error) {
    captureServerError(error, { route: "/api/admin/overview" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load admin overview." },
      { status: error instanceof AuthError ? error.status : 500 }
    );
  }
}
