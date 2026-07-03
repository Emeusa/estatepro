import { NextRequest, NextResponse } from "next/server";

import { verifyPaystackWebhookSignature } from "@/lib/paystack";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { processPaystackWebhook } from "@/modules/billing/billing.service";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  try {
    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      await logSecurityEvent({
        request,
        action: "billing_webhook_invalid_signature",
        result: "blocked"
      });
      return NextResponse.json({ message: "Invalid signature." }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as { event: string; data?: Record<string, unknown> };
    await processPaystackWebhook(event);

    await logSecurityEvent({
      request,
      action: "billing_webhook_processed",
      result: "success",
      metadata: { event: event.event }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    captureServerError(error, { route: "/api/billing/webhook" });
    return NextResponse.json({ message: "Webhook processing failed." }, { status: 400 });
  }
}
