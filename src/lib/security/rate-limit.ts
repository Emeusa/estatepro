import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

import { logSecurityEvent } from "@/lib/security/logger";
import { getClientIp } from "@/lib/security/request";

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  publicRead: { name: "public-read", limit: 120, windowSeconds: 60 },
  authBotCheck: { name: "auth-bot-check", limit: 30, windowSeconds: 60 },
  login: { name: "login", limit: 12, windowSeconds: 5 * 60 },
  clientRegister: { name: "client-register", limit: 5, windowSeconds: 60 * 60 },
  agentRegister: { name: "agent-register", limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { name: "password-reset", limit: 5, windowSeconds: 60 * 60 },
  listingReportHourly: { name: "listing-report-hourly", limit: 5, windowSeconds: 60 * 60 },
  listingReportDaily: { name: "listing-report-daily", limit: 20, windowSeconds: 24 * 60 * 60 },
  admin: { name: "admin", limit: 60, windowSeconds: 60 },
  userApi: { name: "user-api", limit: 90, windowSeconds: 60 }
} satisfies Record<string, RateLimitPolicy>;

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const localAttempts = new Map<string, { count: number; reset: number }>();
const limiters = new Map<string, Ratelimit>();

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

function getUpstashLimiter(policy: RateLimitPolicy) {
  const redis = getRedis();
  if (!redis) {
    return null;
  }

  const cacheKey = `${policy.name}:${policy.limit}:${policy.windowSeconds}`;
  const cached = limiters.get(cacheKey);
  if (cached) {
    return cached;
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSeconds} s`),
    prefix: `estatehub:${policy.name}`,
    analytics: true
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

async function checkLocalLimit(policy: RateLimitPolicy, key: string): Promise<LimitResult> {
  const now = Date.now();
  const reset = now + policy.windowSeconds * 1000;
  const current = localAttempts.get(key);

  if (!current || current.reset <= now) {
    localAttempts.set(key, { count: 1, reset });
    return { success: true, limit: policy.limit, remaining: policy.limit - 1, reset };
  }

  if (current.count >= policy.limit) {
    return { success: false, limit: policy.limit, remaining: 0, reset: current.reset };
  }

  current.count += 1;
  localAttempts.set(key, current);
  return {
    success: true,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - current.count),
    reset: current.reset
  };
}

function rateLimitHeaders(result: LimitResult) {
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.reset / 1000).toString(),
    "Retry-After": retryAfter.toString()
  };
}

export async function rateLimit(
  request: NextRequest,
  policy: RateLimitPolicy,
  key: string,
  userId?: string | null
) {
  const scopedKey = `${policy.name}:${key}`;
  const limiter = getUpstashLimiter(policy);
  const result = limiter
    ? await limiter.limit(scopedKey)
    : await checkLocalLimit(policy, scopedKey);

  if (result.success) {
    return { allowed: true as const, headers: rateLimitHeaders(result) };
  }

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  await logSecurityEvent({
    request,
    action: "rate_limit_exceeded",
    result: "blocked",
    userId,
    metadata: { policy: policy.name }
  });

  return {
    allowed: false as const,
    response: NextResponse.json(
      {
        error: "Too many requests",
        message: "Too many requests. Please wait a moment and try again.",
        retryAfter
      },
      { status: 429, headers: rateLimitHeaders(result) }
    )
  };
}

export async function rateLimitByIp(request: NextRequest, policy: RateLimitPolicy) {
  return rateLimit(request, policy, getClientIp(request));
}

export function withRateLimitHeaders(response: NextResponse, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
