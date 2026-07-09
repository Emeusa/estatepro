import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError, requireAgent } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { createAgentSupportRequest } from "@/modules/support/support.service";

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const supportRequest = await createAgentSupportRequest(decoded.uid, await request.json());
    await logSecurityEvent({
      request,
      action: "support_request_created",
      result: "success",
      userId: decoded.uid,
      metadata: { supportRequestId: supportRequest.id, priority: supportRequest.priority }
    });

    return withRateLimitHeaders(NextResponse.json({ supportRequest }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/support/requests" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not create support request." },
      { status: error instanceof AuthError ? error.status : error instanceof ZodError ? 400 : 400 }
    );
  }
}
