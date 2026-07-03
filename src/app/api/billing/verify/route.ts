import { NextRequest, NextResponse } from "next/server";

import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimitByIp, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getSiteUrl } from "@/lib/seo";
import { applySuccessfulPaystackTransaction } from "@/modules/billing/billing.service";

function billingRedirect(status: "success" | "failed") {
  const url = getSiteUrl();
  url.pathname = "/agents/dashboard";
  url.search = "";
  url.searchParams.set("billing", status);
  url.hash = "subscription";
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const limited = await rateLimitByIp(request, RATE_LIMITS.publicRead);
  if (!limited.allowed) {
    return limited.response;
  }

  const reference = request.nextUrl.searchParams.get("reference");
  const wantsJson = request.nextUrl.searchParams.get("format") === "json";

  if (!reference) {
    const response = wantsJson
      ? NextResponse.json({ message: "Missing payment reference." }, { status: 400 })
      : billingRedirect("failed");
    return withRateLimitHeaders(response, limited.headers);
  }

  try {
    const subscription = await applySuccessfulPaystackTransaction(reference);
    await logSecurityEvent({
      request,
      action: "billing_payment_verified",
      result: "success",
      userId: subscription.agentId,
      metadata: { reference, planSlug: subscription.planSlug }
    });

    const response = wantsJson ? NextResponse.json({ ok: true, subscription }) : billingRedirect("success");
    return withRateLimitHeaders(response, limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/billing/verify", reference });
    const response = wantsJson
      ? NextResponse.json(
          { message: error instanceof Error ? error.message : "Payment verification failed." },
          { status: 400 }
        )
      : billingRedirect("failed");
    return withRateLimitHeaders(response, limited.headers);
  }
}
