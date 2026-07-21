import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError, requireAdmin } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import {
  AdminSubscriptionGrantError,
  grantAdminSubscription
} from "@/modules/subscriptions/admin-grant.service";

type Props = {
  params: Promise<{ agentId: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { agentId } = await params;
    const result = await grantAdminSubscription({
      agentId,
      adminId: decoded.uid,
      payload: await request.json()
    });

    await logSecurityEvent({
      request,
      action: "admin_subscription_grant",
      result: "success",
      userId: decoded.uid,
      metadata: {
        agentId,
        planSlug: result.subscription.planSlug,
        periodEnd: result.subscription.currentPeriodEnd
      }
    });

    return withRateLimitHeaders(NextResponse.json(result), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/admin/agents/[agentId]/subscription-grant" });
    const status =
      error instanceof AuthError
        ? error.status
        : error instanceof AdminSubscriptionGrantError
          ? error.status
          : error instanceof ZodError
            ? 400
            : 400;

    const message =
      error instanceof ZodError
        ? "Invalid subscription grant request."
        : error instanceof Error
          ? error.message
          : "Could not grant subscription.";

    return NextResponse.json({ message }, { status });
  }
}
