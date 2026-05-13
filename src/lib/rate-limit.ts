import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function enforceRateLimit(request: NextRequest, scope: string) {
  const now = Date.now();
  const key = `${scope}:${getClientIp(request)}`;
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (current.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { message: "Too many signup attempts. Please wait a few minutes and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((current.resetAt - now) / 1000).toString()
        }
      }
    );
  }

  current.count += 1;
  attempts.set(key, current);
  return null;
}
