import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { getClientIp } from "@/lib/security/request";

const TURNSTILE_VERIFY_TIMEOUT_MS = 5000;
const TURNSTILE_MAX_ATTEMPTS = 2;

export type TurnstileFailureCategory =
  | "missing_token"
  | "expired_token"
  | "invalid_token"
  | "configuration"
  | "cloudflare_internal"
  | "cloudflare_unavailable";

type TurnstileResult =
  | { success: true; skipped: boolean }
  | { success: false; message: string; category: TurnstileFailureCategory };

type TurnstileVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

function turnstileRetryMessage() {
  return "Security check could not be confirmed. Tap retry, complete the check, and try again.";
}

function categorizeTurnstileFailure(errorCodes: string[]): TurnstileFailureCategory {
  if (errorCodes.includes("timeout-or-duplicate")) {
    return "expired_token";
  }

  if (errorCodes.includes("missing-input-response")) {
    return "missing_token";
  }

  if (
    errorCodes.includes("missing-input-secret") ||
    errorCodes.includes("invalid-input-secret") ||
    errorCodes.includes("bad-request")
  ) {
    return "configuration";
  }

  if (errorCodes.includes("internal-error")) {
    return "cloudflare_internal";
  }

  return "invalid_token";
}

function messageForCategory(category: TurnstileFailureCategory) {
  if (category === "missing_token") {
    return "Security check is still loading. Wait a few seconds, then try again.";
  }

  if (category === "expired_token") {
    return "Security check expired. Tap retry, then submit again.";
  }

  if (category === "cloudflare_unavailable") {
    return "Security check could not be reached. Check your connection, tap retry, and try again.";
  }

  return turnstileRetryMessage();
}

export async function verifyTurnstile(request: NextRequest, token?: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: true, skipped: true };
  }

  if (!token) {
    return {
      success: false,
      message: messageForCategory("missing_token"),
      category: "missing_token"
    };
  }

  const idempotencyKey = randomUUID();

  for (let attempt = 0; attempt < TURNSTILE_MAX_ATTEMPTS; attempt += 1) {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    body.set("remoteip", getClientIp(request));
    body.set("idempotency_key", idempotencyKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TURNSTILE_VERIFY_TIMEOUT_MS);

    try {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body,
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt + 1 < TURNSTILE_MAX_ATTEMPTS) {
          continue;
        }

        const category: TurnstileFailureCategory = "cloudflare_unavailable";
        return { success: false, message: messageForCategory(category), category };
      }

      const data = (await response.json().catch(() => ({}))) as TurnstileVerifyResponse;
      if (data.success) {
        return { success: true, skipped: false };
      }

      const errorCodes = Array.isArray(data["error-codes"]) ? data["error-codes"] : [];
      const category = categorizeTurnstileFailure(errorCodes);
      if (category === "cloudflare_internal" && attempt + 1 < TURNSTILE_MAX_ATTEMPTS) {
        continue;
      }

      return { success: false, message: messageForCategory(category), category };
    } catch {
      if (attempt + 1 < TURNSTILE_MAX_ATTEMPTS) {
        continue;
      }

      const category: TurnstileFailureCategory = "cloudflare_unavailable";
      return { success: false, message: messageForCategory(category), category };
    } finally {
      clearTimeout(timeout);
    }
  }

  const category: TurnstileFailureCategory = "cloudflare_unavailable";
  return { success: false, message: messageForCategory(category), category };
}
