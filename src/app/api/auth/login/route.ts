import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { assertBotProtection, botProtectionSchema, isBotProtectionError } from "@/lib/security/bot";
import { hashValue, getClientIp } from "@/lib/security/request";
import { logSecurityEvent, captureServerError } from "@/lib/security/logger";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";
import { sendWelcomeEmailForUser } from "@/modules/email/email.service";

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
  ...botProtectionSchema.shape
}).strict();

async function sendWelcomeEmailSafely(userId: string) {
  try {
    await sendWelcomeEmailForUser(userId);
  } catch (error) {
    console.error("Welcome email failed after login", {
      userId,
      error: error instanceof Error ? error.message : "unknown"
    });
  }
}

function scheduleWelcomeEmail(userId: string) {
  try {
    after(() => sendWelcomeEmailSafely(userId));
  } catch {
    // Vitest and some non-Next runtimes do not provide an after() request scope.
    void sendWelcomeEmailSafely(userId);
  }
}

export async function POST(request: NextRequest) {
  let userEmailHash = "unknown";

  try {
    const body = loginSchema.parse(await request.json());
    userEmailHash = hashValue(body.email);
    const botLimited = await rateLimit(request, RATE_LIMITS.authBotCheck, getClientIp(request));
    if (!botLimited.allowed) {
      return botLimited.response;
    }

    await assertBotProtection(request, body, "login_attempt");

    const limited = await rateLimit(
      request,
      RATE_LIMITS.login,
      `${getClientIp(request)}:${userEmailHash}`
    );
    if (!limited.allowed) {
      return limited.response;
    }

    const supabase = createServerSupabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password
    });

    if (error || !data.session) {
      await logSecurityEvent({
        request,
        action: "login_attempt",
        result: "failed",
        metadata: { emailHash: userEmailHash }
      });
      const message = error?.message.toLowerCase() ?? "";
      if (message.includes("email not confirmed") || message.includes("email_not_confirmed")) {
        return withRateLimitHeaders(
          NextResponse.json({ message: "Please confirm your email before signing in." }, { status: 403 }),
          limited.headers
        );
      }
      return withRateLimitHeaders(
        NextResponse.json({ message: "Invalid email or password." }, { status: 401 }),
        limited.headers
      );
    }

    await logSecurityEvent({
      request,
      action: "login_attempt",
      result: "success",
      userId: data.user?.id,
      metadata: { emailHash: userEmailHash }
    });
    if (data.user?.id) {
      scheduleWelcomeEmail(data.user.id);
    }

    return withRateLimitHeaders(NextResponse.json({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      }
    }), limited.headers);
  } catch (error) {
    if (isBotProtectionError(error)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    captureServerError(error, { route: "/api/auth/login", emailHash: userEmailHash });
    await logSecurityEvent({
      request,
      action: "login_attempt",
      result: "failed",
      metadata: { emailHash: userEmailHash, reason: error instanceof Error ? error.message : "unknown" }
    });
    return NextResponse.json({ message: "Invalid email or password." }, { status: 400 });
  }
}
