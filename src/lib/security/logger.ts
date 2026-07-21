import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

import { getClientIp, getRequestId, getUserAgent, hashIp } from "@/lib/security/request";

type SecurityEventInput = {
  request: NextRequest;
  action: string;
  result: "allowed" | "blocked" | "failed" | "success";
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

function cleanMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) {
    return {};
  }

  const blockedKeys = new Set([
    "password",
    "token",
    "access_token",
    "refresh_token",
    "ninNumber",
    "nin_number",
    "cacNumber",
    "cac_number"
  ]);
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !blockedKeys.has(key))
  );
}

export async function logSecurityEvent(input: SecurityEventInput) {
  const ip = getClientIp(input.request);

  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = createServerSupabaseClient();
    await supabase.from("security_events").insert({
      request_id: getRequestId(input.request),
      route: input.request.nextUrl.pathname,
      action: input.action,
      result: input.result,
      user_id: input.userId ?? null,
      ip_hash: hashIp(ip),
      user_agent: getUserAgent(input.request),
      metadata: cleanMetadata(input.metadata)
    });
  } catch {
    // Logging must never break the user-facing request path.
  }
}

export function captureServerError(error: unknown, context?: Record<string, unknown>) {
  if (!(error instanceof Error)) {
    return;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Server error captured", cleanMetadata(context), error);
    }
    return;
  }

  try {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace("/", "");
    const endpoint = `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`;

    void fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=estatehub/1.0`
      },
      body: JSON.stringify({
        event_id: randomUUID().replace(/-/g, ""),
        timestamp: new Date().toISOString(),
        platform: "javascript",
        logger: "estatehub-api",
        level: "error",
        message: error.message,
        exception: {
          values: [
            {
              type: error.name,
              value: error.message
            }
          ]
        },
        extra: cleanMetadata(context)
      })
    }).catch(() => undefined);
  } catch {
    // Invalid monitoring config must not affect request handling.
  }
}
