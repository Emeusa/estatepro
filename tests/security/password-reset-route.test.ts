import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  logSecurityEvent: vi.fn(),
  rateLimit: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyTurnstile: vi.fn(),
  withRateLimitHeaders: vi.fn()
}));

vi.mock("@/lib/security/logger", () => ({
  captureServerError: mocks.captureServerError,
  logSecurityEvent: mocks.logSecurityEvent
}));

vi.mock("@/lib/security/rate-limit", () => ({
  RATE_LIMITS: {
    authBotCheck: { name: "auth-bot-check", limit: 30, windowSeconds: 60 },
    passwordReset: { name: "password-reset", limit: 5, windowSeconds: 60 * 60 }
  },
  rateLimit: mocks.rateLimit,
  withRateLimitHeaders: mocks.withRateLimitHeaders
}));

vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseAuthClient: () => ({
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail
    }
  })
}));

import { POST } from "../../src/app/api/auth/password-reset/route";

function resetRequest() {
  return new NextRequest("http://localhost:3000/api/auth/password-reset", {
    method: "POST",
    headers: {
      "x-forwarded-for": "203.0.113.47"
    },
    body: JSON.stringify({
      email: "USER@Example.COM",
      website: "",
      formStartedAt: Date.now() - 5000,
      turnstileToken: "token"
    })
  });
}

describe("password reset route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());

    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
    mocks.resetPasswordForEmail.mockResolvedValue({});
    mocks.verifyTurnstile.mockResolvedValue({ success: true, skipped: false });
    mocks.withRateLimitHeaders.mockImplementation((response: NextResponse) => response);
  });

  it("checks Turnstile before consuming the reset limiter", async () => {
    const response = await POST(resetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("If this email is registered, password reset instructions will be sent.");
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      1,
      expect.any(NextRequest),
      expect.objectContaining({ name: "auth-bot-check" }),
      "203.0.113.47"
    );
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      2,
      expect.any(NextRequest),
      expect.objectContaining({ name: "password-reset" }),
      expect.stringContaining("203.0.113.47:")
    );
  });

  it("does not consume the password reset limiter when Turnstile fails", async () => {
    mocks.verifyTurnstile.mockResolvedValue({
      success: false,
      message: "Security check could not be confirmed. Tap retry, complete the check, and try again."
    });

    const response = await POST(resetRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Security check could not be confirmed. Tap retry, complete the check, and try again.");
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ name: "auth-bot-check" }),
      "203.0.113.47"
    );
  });
});
