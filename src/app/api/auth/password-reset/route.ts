import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSiteUrl } from "@/lib/seo";
import { assertBotProtection, botProtectionSchema, isBotProtectionError } from "@/lib/security/bot";
import { logSecurityEvent, captureServerError } from "@/lib/security/logger";
import { getClientIp, hashValue } from "@/lib/security/request";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

const resetSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  ...botProtectionSchema.shape
}).strict();

export async function POST(request: NextRequest) {
  let emailHash = "unknown";
  let rateHeaders: Record<string, string> | null = null;

  try {
    const body = resetSchema.parse(await request.json());
    emailHash = hashValue(body.email);
    const botLimited = await rateLimit(request, RATE_LIMITS.authBotCheck, getClientIp(request));
    if (!botLimited.allowed) {
      return botLimited.response;
    }

    await assertBotProtection(request, body, "password_reset_request");

    const limited = await rateLimit(
      request,
      RATE_LIMITS.passwordReset,
      `${getClientIp(request)}:${emailHash}`
    );
    if (!limited.allowed) {
      return limited.response;
    }
    rateHeaders = limited.headers;

    const supabase = createServerSupabaseAuthClient();
    await supabase.auth.resetPasswordForEmail(body.email, {
      redirectTo: new URL("/auth/reset-password", getSiteUrl()).toString()
    });

    await logSecurityEvent({
      request,
      action: "password_reset_request",
      result: "success",
      metadata: { emailHash }
    });
  } catch (error) {
    if (isBotProtectionError(error)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    captureServerError(error, { route: "/api/auth/password-reset", emailHash });
    await logSecurityEvent({
      request,
      action: "password_reset_request",
      result: "failed",
      metadata: { emailHash }
    });
  }

  return withRateLimitHeaders(
    NextResponse.json({
      message: "If this email is registered, password reset instructions will be sent."
    }),
    rateHeaders ?? {}
  );
}
