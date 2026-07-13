import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAgentAccount: vi.fn(),
  rateLimit: vi.fn(),
  withRateLimitHeaders: vi.fn()
}));

vi.mock("@/modules/agents/agent.service", () => ({
  createAgentAccount: mocks.createAgentAccount
}));

vi.mock("@/lib/security/rate-limit", () => ({
  RATE_LIMITS: {
    agentRegister: { limit: 5, window: "1 h" }
  },
  rateLimit: mocks.rateLimit,
  withRateLimitHeaders: mocks.withRateLimitHeaders
}));

vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstile: vi.fn(async () => ({ success: true }))
}));

vi.mock("@/lib/security/logger", () => ({
  captureServerError: vi.fn(),
  logSecurityEvent: vi.fn()
}));

import { POST } from "../../src/app/api/agents/register/route";

function agentRegisterRequest() {
  return new NextRequest("http://localhost:3000/api/agents/register", {
    method: "POST",
    body: JSON.stringify({
      email: "AGENT@Example.COM",
      password: "strongpass",
      fullName: "Test Agent",
      phone: "08031234567",
      ninNumber: "12345678901",
      acceptedLegalTerms: true,
      website: "",
      formStartedAt: Date.now() - 5000,
      turnstileToken: "token"
    })
  });
}

describe("registration confirmation flow", () => {
  beforeEach(() => {
    mocks.createAgentAccount.mockReset();
    mocks.rateLimit.mockReset();
    mocks.withRateLimitHeaders.mockReset();

    mocks.createAgentAccount.mockResolvedValue({
      user: {
        id: "agent-id",
        email: "agent@example.com",
        fullName: "Test Agent",
        phone: "+2348031234567",
        role: "agent"
      }
    });
    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: new Headers() });
    mocks.withRateLimitHeaders.mockImplementation((response) => response);
  });

  it("returns a check-email redirect URL after agent registration succeeds", async () => {
    const response = await POST(agentRegisterRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.checkEmailUrl).toBe("/auth/check-email?email=agent%40example.com&type=agent");
    expect(mocks.createAgentAccount).toHaveBeenCalledWith({
      email: "agent@example.com",
      password: "strongpass",
      fullName: "Test Agent",
      phone: "+2348031234567",
      ninNumber: "12345678901"
    });
  });

  it("does not use the async React event target reset pattern in registration forms", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/auth-forms.tsx"), "utf8");

    expect(source).not.toContain("event.currentTarget.reset()");
    expect(source).toContain('redirectToCheckEmail(email, "client", response.checkEmailUrl);');
    expect(source).toContain('redirectToCheckEmail(email, "agent", response.checkEmailUrl);');
  });
});
