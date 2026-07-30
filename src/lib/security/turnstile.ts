import { NextRequest } from "next/server";

import { getClientIp } from "@/lib/security/request";

const TURNSTILE_VERIFY_TIMEOUT_MS = 5000;

type TurnstileResult =
  | { success: true; skipped: boolean }
  | { success: false; message: string };

function turnstileRetryMessage() {
  return "Security check could not be confirmed. Tap retry, complete the check, and try again.";
}

export async function verifyTurnstile(request: NextRequest, token?: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: true, skipped: true };
  }

  if (!token) {
    return { success: false, message: "Security check is still loading. Wait a few seconds, then try again." };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  body.set("remoteip", getClientIp(request));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: controller.signal
    });
    const data = (await response.json().catch(() => ({}))) as { success?: boolean };

    if (!data.success) {
      return {
        success: false,
        message: turnstileRetryMessage()
      };
    }
  } catch {
    return {
      success: false,
      message: "Security check could not be reached. Check your connection, tap retry, and try again."
    };
  } finally {
    clearTimeout(timeout);
  }

  return { success: true, skipped: false };
}
