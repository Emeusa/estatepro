import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getReportForAdmin, updateReportForAdmin } from "@/modules/reports/report.service";

type Props = {
  params: Promise<{ reportId: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { reportId } = await params;
    const report = await getReportForAdmin(reportId);
    if (!report) {
      return withRateLimitHeaders(NextResponse.json({ message: "Report not found." }, { status: 404 }), limited.headers);
    }
    return withRateLimitHeaders(NextResponse.json({ report }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/admin/reports/[reportId]" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load report." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { reportId } = await params;
    const body = await request.json();
    const report = await updateReportForAdmin(reportId, decoded.uid, body);

    await logSecurityEvent({
      request,
      action: "listing_report_update",
      result: "success",
      userId: decoded.uid,
      metadata: {
        reportId,
        status: report.status,
        actionTaken: report.actionTaken,
        listingId: report.listingId,
        agentId: report.agentId
      }
    });

    return withRateLimitHeaders(NextResponse.json({ report }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/admin/reports/[reportId]", method: "PATCH" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update report." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
