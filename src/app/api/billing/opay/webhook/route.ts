import { NextRequest, NextResponse } from "next/server";

import { OpayCallbackEvent, verifyOpayCallbackSignature } from "@/lib/opay";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { processOpayWebhook } from "@/modules/billing/billing.service";

export async function POST(request: NextRequest) {
  try {
    const event = (await request.json()) as OpayCallbackEvent;
    if (!verifyOpayCallbackSignature(event)) {
      await logSecurityEvent({
        request,
        action: "billing_opay_webhook_invalid_signature",
        result: "blocked"
      });
      return NextResponse.json({ message: "Invalid signature." }, { status: 401 });
    }

    await processOpayWebhook(event);
    await logSecurityEvent({
      request,
      action: "billing_opay_webhook_processed",
      result: "success",
      metadata: { reference: event.payload?.reference, status: event.payload?.status }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    captureServerError(error, { route: "/api/billing/opay/webhook" });
    return NextResponse.json({ message: "Webhook processing failed." }, { status: 400 });
  }
}
