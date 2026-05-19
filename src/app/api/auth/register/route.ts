import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { assertBotProtection, botProtectionSchema } from "@/lib/security/bot";
import { captureServerError } from "@/lib/security/logger";
import { getClientIp } from "@/lib/security/request";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { clientRegistrationRequestSchema } from "@/modules/agents/agent.schema";
import { createClientAccount } from "@/modules/agents/agent.service";

function getFriendlyMessage(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    if (!issue) {
      return "We could not create your account. Please check your details and try again.";
    }

    if (issue.path.includes("email")) {
      return "Enter a valid email address.";
    }

    if (issue.path.includes("password")) {
      return "Your password must be at least 6 characters long.";
    }

    if (issue.path.includes("phone")) {
      return "Enter a valid phone number or leave it blank.";
    }

    return "We could not create your account. Please check your details and try again.";
  }

  if (!(error instanceof Error)) {
    return "We could not create your account. Please try again.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("auth/email-already-exists") || message.includes("already exists")) {
    return "An account with this email already exists.";
  }

  if (message.includes("auth/invalid-email") || message.includes("email")) {
    return "Enter a valid email address.";
  }

  if (message.includes("auth/invalid-password") || message.includes("password")) {
    return "Your password must be at least 6 characters long.";
  }

  if (message.includes("auth/invalid-phone-number") || message.includes("phone")) {
    return "Enter a valid phone number or leave it blank.";
  }

  return `Account creation failed: ${error.message}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = clientRegistrationRequestSchema.parse(await request.json());
    const botFields = botProtectionSchema.parse(body);
    const limited = await rateLimit(request, RATE_LIMITS.auth, getClientIp(request));
    if (!limited.allowed) {
      return limited.response;
    }
    await assertBotProtection(request, botFields, "client_registration");
    const result = await createClientAccount({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
      phone: body.phone
    });
    return withRateLimitHeaders(NextResponse.json(result, { status: 201 }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/auth/register" });
    return NextResponse.json(
      { message: getFriendlyMessage(error) },
      { status: 400 }
    );
  }
}
