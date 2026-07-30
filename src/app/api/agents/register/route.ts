import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { assertBotProtection, botProtectionSchema, isBotProtectionError } from "@/lib/security/bot";
import { captureServerError } from "@/lib/security/logger";
import { getClientIp, hashValue } from "@/lib/security/request";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { buildCheckEmailUrl } from "@/lib/auth-confirmation";
import { agentRegistrationRequestSchema } from "@/modules/agents/agent.schema";
import { createAgentAccount } from "@/modules/agents/agent.service";

function getFriendlyMessage(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    if (!issue) {
      return "We could not create the agent account. Please check your details and try again.";
    }

    if (issue.path.includes("email")) {
      return "Enter a valid email address.";
    }

    if (issue.path.includes("password")) {
      return "Your password must be at least 6 characters long.";
    }

    if (issue.path.includes("phone")) {
      return "Enter a valid phone number.";
    }

    if (issue.path.includes("ninNumber")) {
      return "Your NIN must be exactly 11 digits.";
    }

    if (issue.path.includes("cacNumber")) {
      return "Enter a valid CAC registration number.";
    }

    if (issue.path.includes("acceptedLegalTerms")) {
      return "Please agree to the Terms and Conditions and Privacy Policy before creating an agent account.";
    }

    return "We could not create the agent account. Please check your details and try again.";
  }

  if (!(error instanceof Error)) {
    return "We could not create the agent account. Please try again.";
  }

  const originalMessage = error.message;
  const message = originalMessage.toLowerCase();

  if (isBotProtectionError(error)) {
    return originalMessage;
  }

  if (message.includes("nin")) {
    return originalMessage;
  }

  if (message.includes("cac")) {
    return originalMessage;
  }

  if (message.includes("auth email availability helper")) {
    return "Supabase setup is incomplete: auth email availability helper is missing or not initialized.";
  }

  if (message.includes("auth/email-already-exists") || message.includes("already exists")) {
    return "An account with this email already exists. Please log in or reset your password.";
  }

  if (message.includes("users table is missing")) {
    return "Supabase setup is incomplete: users table is missing or not initialized.";
  }

  if (message.includes("agents table is missing")) {
    return "Supabase setup is incomplete: agents table is missing or not initialized.";
  }

  if (message.includes("subscriptions table is missing")) {
    return "Supabase setup is incomplete: subscriptions table is missing or not initialized.";
  }

  if (message.includes("agent profile could not be created")) {
    return "Agent profile could not be created. Please try again.";
  }

  if (message.includes("subscription record could not be created")) {
    return "Agent subscription setup failed. Please try again.";
  }

  if (message.includes("auth/invalid-email") || (message.includes("email") && !message.includes("table"))) {
    return "Enter a valid email address.";
  }

  if (message.includes("auth/invalid-password") || message.includes("password")) {
    return "Your password must be at least 6 characters long.";
  }

  if (message.includes("auth/invalid-phone-number") || message.includes("phone")) {
    return "Enter a valid phone number.";
  }

  return `Agent account creation failed: ${originalMessage}`;
}

function getErrorStatus(error: unknown) {
  if (error instanceof ZodError) {
    return 400;
  }

  if (!(error instanceof Error)) {
    return 400;
  }

  const message = error.message.toLowerCase();
  if (message.includes("already exists")) {
    return 409;
  }

  if (message.includes("setup is incomplete") || message.includes("missing or not initialized")) {
    return 500;
  }

  return 400;
}

export async function POST(request: NextRequest) {
  try {
    const body = agentRegistrationRequestSchema.parse(await request.json());
    const botFields = botProtectionSchema.parse(body);
    const botLimited = await rateLimit(request, RATE_LIMITS.authBotCheck, getClientIp(request));
    if (!botLimited.allowed) {
      return botLimited.response;
    }
    await assertBotProtection(request, botFields, "agent_registration");
    const limited = await rateLimit(
      request,
      RATE_LIMITS.agentRegister,
      `${getClientIp(request)}:${hashValue(body.email)}`
    );
    if (!limited.allowed) {
      return limited.response;
    }
    const result = await createAgentAccount({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
      phone: body.phone,
      ninNumber: body.ninNumber,
      cacNumber: body.cacNumber
    });
    return withRateLimitHeaders(
      NextResponse.json(
        {
          ...result,
          checkEmailUrl: buildCheckEmailUrl(body.email, "agent")
        },
        { status: 201 }
      ),
      limited.headers
    );
  } catch (error) {
    const status = getErrorStatus(error);
    if (status >= 500) {
      captureServerError(error, { route: "/api/agents/register" });
    }
    return NextResponse.json(
      { message: getFriendlyMessage(error) },
      { status }
    );
  }
}
