import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { markAdminNotificationRead } from "@/modules/reports/report.service";

type Props = {
  params: Promise<{ notificationId: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { notificationId } = await params;
    const notification = await markAdminNotificationRead(notificationId);
    return withRateLimitHeaders(NextResponse.json({ notification }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/admin/notifications/[notificationId]/read" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update notification." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
