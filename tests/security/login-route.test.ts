import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  logSecurityEvent: vi.fn(),
  rateLimit: vi.fn(),
  sendWelcomeEmailForUser: vi.fn(),
  signInWithPassword: vi.fn(),
  withRateLimitHeaders: vi.fn()
}));

vi.mock("@/lib/security/logger", () => ({
  captureServerError: mocks.captureServerError,
  logSecurityEvent: mocks.logSecurityEvent
}));

vi.mock("@/lib/security/rate-limit", () => ({
  RATE_LIMITS: {
    auth: { name: "auth", limit: 5, windowSeconds: 60 }
  },
  rateLimit: mocks.rateLimit,
  withRateLimitHeaders: mocks.withRateLimitHeaders
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
    mocks.withRateLimitHeaders.mockReset();

    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
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

    await vi.waitFor(() => {
      expect(mocks.sendWelcomeEmailForUser).toHaveBeenCalledWith("user-id");
    });

    consoleError.mockRestore();
  });
});
