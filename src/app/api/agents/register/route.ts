import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

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

    return "We could not create the agent account. Please check your details and try again.";
  }

  if (!(error instanceof Error)) {
    return "We could not create the agent account. Please try again.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("auth/email-already-exists") || message.includes("already exists")) {
    return "An account with this email already exists.";
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

  return `Agent account creation failed: ${error.message}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createAgentAccount(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: getFriendlyMessage(error) },
      { status: 400 }
    );
  }
}
