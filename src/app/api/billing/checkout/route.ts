import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAgent } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { startBillingCheckout } from "@/modules/billing/billing.service";

const checkoutSchema = z.object({
  planSlug: z.string().trim(),
  provider: z.enum(["paystack", "opay"]).optional()
});

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const body = checkoutSchema.parse(await request.json());
    const checkout = await startBillingCheckout({
      agentId: decoded.uid,
      email: decoded.email,
      planSlug: body.planSlug,
      provider: body.provider
    });

    await logSecurityEvent({
      request,
      action: "billing_checkout_initialized",
      result: "success",
      userId: decoded.uid,
      metadata: { planSlug: body.planSlug, provider: body.provider ?? "paystack", reference: checkout.reference }
    });

    return withRateLimitHeaders(NextResponse.json(checkout), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/billing/checkout" });
    const status =
      error instanceof AuthError
        ? error.status
        : error instanceof Error && error.name === "BillingApprovalRequiredError"
          ? 403
          : 400;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not start billing checkout." },
      { status }
    );
  }
}
