import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  createClientAccount: vi.fn(),
  rateLimit: vi.fn(),
  verifyTurnstile: vi.fn(),
  withRateLimitHeaders: vi.fn()
}));

vi.mock("@/modules/agents/agent.service", () => ({
  createClientAccount: mocks.createClientAccount
}));

vi.mock("@/lib/security/rate-limit", () => ({
  RATE_LIMITS: {
    authBotCheck: { name: "auth-bot-check", limit: 30, windowSeconds: 60 },
    clientRegister: { name: "client-register", limit: 5, windowSeconds: 60 * 60 }
  },
  rateLimit: mocks.rateLimit,
  withRateLimitHeaders: mocks.withRateLimitHeaders
}));

vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile
}));

vi.mock("@/lib/security/logger", () => ({
  captureServerError: mocks.captureServerError,
  logSecurityEvent: vi.fn()
}));

import { POST } from "../../src/app/api/auth/register/route";

function clientRegisterRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: {
      "x-forwarded-for": "203.0.113.45"
    },
    body: JSON.stringify({
      email: "CLIENT@Example.COM",
      password: "strongpass",
      fullName: undefined,
      phone: null,
      website: "",
      formStartedAt: Date.now() - 5000,
      turnstileToken: "token",
      ...overrides
    })
  });
}

describe("client registration route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());

    mocks.createClientAccount.mockResolvedValue({
      user: {
        id: "client-id",
        email: "client@example.com",
        fullName: "Client User",
        phone: null,
        role: "client"
      }
    });
    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
    mocks.verifyTurnstile.mockResolvedValue({ success: true, skipped: false });
    mocks.withRateLimitHeaders.mockImplementation((response: NextResponse) => response);
  });

  it("returns a check-email redirect URL after client registration succeeds", async () => {
    const response = await POST(clientRegisterRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.checkEmailUrl).toBe("/auth/check-email?email=client%40example.com&type=client");
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      1,
      expect.any(NextRequest),
      expect.objectContaining({ name: "auth-bot-check" }),
      "203.0.113.45"
    );
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      2,
      expect.any(NextRequest),
      expect.objectContaining({ name: "client-register" }),
      expect.stringContaining("203.0.113.45:")
    );
  });

  it("returns a conflict when a client email already exists", async () => {
    mocks.createClientAccount.mockRejectedValueOnce(
      new Error("An account with this email already exists. Please log in or reset your password.")
    );

    const response = await POST(clientRegisterRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("An account with this email already exists. Please log in or reset your password.");
  });

  it("does not consume the client registration limiter when Turnstile fails", async () => {
    mocks.verifyTurnstile.mockResolvedValue({
      success: false,
      message: "Security check could not be confirmed. Tap retry, complete the check, and try again."
    });

    const response = await POST(clientRegisterRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Security check could not be confirmed. Tap retry, complete the check, and try again.");
    expect(mocks.createClientAccount).not.toHaveBeenCalled();
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ name: "auth-bot-check" }),
      "203.0.113.45"
    );
  });
});
