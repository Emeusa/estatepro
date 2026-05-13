import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { enforceRateLimit } from "@/lib/rate-limit";
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
  const limited = enforceRateLimit(request, "client-register");
  if (limited) {
    return limited;
  }

  try {
    const body = await request.json();
    const result = await createClientAccount(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: getFriendlyMessage(error) },
      { status: 400 }
    );
  }
}
