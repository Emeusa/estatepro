import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError, getOptionalAuthUser } from "@/lib/auth";
import { assertBotProtection, botProtectionSchema, isBotProtectionError } from "@/lib/security/bot";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { getClientIp } from "@/lib/security/request";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { createListingReport, ReportConflictError, ReportForbiddenError } from "@/modules/reports/report.service";

type Props = {
  params: Promise<{ listingId: string }>;
};

function reportPayloadFromBody(body: Record<string, unknown>) {
  return {
    reason: body.reason,
    details: body.details,
    reporterName: body.reporterName,
    reporterEmail: body.reporterEmail,
    reporterPhone: body.reporterPhone
  };
}

export async function POST(request: NextRequest, { params }: Props) {
  let userId: string | null = null;

  try {
    const decoded = await getOptionalAuthUser(request);
    userId = decoded?.uid ?? null;
    const subject = userId ?? getClientIp(request);
    const hourly = await rateLimit(request, RATE_LIMITS.listingReportHourly, subject, userId);
    if (!hourly.allowed) {
      return hourly.response;
    }
    const daily = await rateLimit(request, RATE_LIMITS.listingReportDaily, subject, userId);
    if (!daily.allowed) {
      return daily.response;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const botFields = botProtectionSchema.parse(body);
    await assertBotProtection(request, botFields, "listing_report");

    const { listingId } = await params;
    const report = await createListingReport({
      listingId,
      reporterUserId: userId,
      request,
      body: reportPayloadFromBody(body)
    });

    await logSecurityEvent({
      request,
      action: "listing_report_created",
      result: "success",
      userId,
      metadata: { listingId, reportId: report.id, reason: report.reason, severity: report.severity }
    });

    return withRateLimitHeaders(
      NextResponse.json({
        reportId: report.id,
        message: "Report submitted. Our admin team will review it."
      }),
      daily.headers
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: "Please provide a valid report reason and at least 20 characters of detail." },
        { status: 400 }
      );
    }

    if (isBotProtectionError(error)) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (error instanceof ReportConflictError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof ReportForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    captureServerError(error, { route: "/api/listings/[listingId]/reports", userId });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not submit report." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
