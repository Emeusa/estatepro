import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  logSecurityEvent: vi.fn(),
  rateLimit: vi.fn(),
  sendWelcomeEmailForUser: vi.fn(),
  signInWithPassword: vi.fn(),
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
    login: { name: "login", limit: 12, windowSeconds: 300 }
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
      signInWithPassword: mocks.signInWithPassword
    }
  })
}));

vi.mock("@/modules/email/email.service", () => ({
  sendWelcomeEmailForUser: mocks.sendWelcomeEmailForUser
}));

import { POST } from "../../src/app/api/auth/login/route";

function loginRequest() {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      "x-forwarded-for": "203.0.113.44"
    },
    body: JSON.stringify({
      email: "USER@Example.COM",
      password: "correct-password",
      website: "",
      formStartedAt: Date.now() - 5000,
      turnstileToken: "token"
    })
  });
}

describe("auth login route", () => {
  beforeEach(() => {
    mocks.captureServerError.mockReset();
    mocks.logSecurityEvent.mockReset();
    mocks.rateLimit.mockReset();
    mocks.sendWelcomeEmailForUser.mockReset();
    mocks.signInWithPassword.mockReset();
    mocks.verifyTurnstile.mockReset();
    mocks.withRateLimitHeaders.mockReset();

    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
    mocks.verifyTurnstile.mockResolvedValue({ success: true, skipped: false });
    mocks.withRateLimitHeaders.mockImplementation((response: NextResponse) => response);
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-id" },
        session: {
          access_token: "access-token",
          refresh_token: "refresh-token"
        }
      },
      error: null
    });
  });

  it("returns a session even when the welcome email fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendWelcomeEmailForUser.mockRejectedValue(new Error("SMTP unavailable"));

    const response = await POST(loginRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token"
    });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "correct-password"
    });
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      1,
      expect.any(NextRequest),
      expect.objectContaining({ name: "auth-bot-check" }),
      "203.0.113.44"
    );
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      2,
      expect.any(NextRequest),
      expect.objectContaining({ name: "login", limit: 12, windowSeconds: 300 }),
      expect.stringContaining("203.0.113.44:")
    );

    await vi.waitFor(() => {
      expect(mocks.sendWelcomeEmailForUser).toHaveBeenCalledWith("user-id");
    });

    consoleError.mockRestore();
  });

  it("does not consume the login attempt limiter when Turnstile fails", async () => {
    mocks.verifyTurnstile.mockResolvedValue({
      success: false,
      message: "Security check could not be confirmed. Tap retry, complete the check, and try again."
    });

    const response = await POST(loginRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Security check could not be confirmed. Tap retry, complete the check, and try again.");
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ name: "auth-bot-check" }),
      "203.0.113.44"
    );
  });

  it("returns a safe generic message for wrong credentials", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: null,
        session: null
      },
      error: { message: "Invalid login credentials" }
    });

    const response = await POST(loginRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Invalid email or password.");
    expect(body.message).not.toMatch(/user not found|wrong password/i);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "correct-password"
    });
  });
});
