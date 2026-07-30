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

function agentRegisterRequest(overrides: Record<string, unknown> = {}) {
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
      turnstileToken: "token",
      ...overrides
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
      ninNumber: "12345678901",
      cacNumber: null
    });
  });

  it("returns a check-email redirect URL after CAC-only agent registration succeeds", async () => {
    const response = await POST(agentRegisterRequest({ ninNumber: "", cacNumber: "rc 1234567" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.checkEmailUrl).toBe("/auth/check-email?email=agent%40example.com&type=agent");
    expect(mocks.createAgentAccount).toHaveBeenCalledWith({
      email: "agent@example.com",
      password: "strongpass",
      fullName: "Test Agent",
      phone: "+2348031234567",
      ninNumber: null,
      cacNumber: "RC1234567"
    });
  });

  it("allows agent registration when both NIN and CAC are blank", async () => {
    const response = await POST(agentRegisterRequest({ ninNumber: "", cacNumber: "" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.checkEmailUrl).toBe("/auth/check-email?email=agent%40example.com&type=agent");
    expect(mocks.createAgentAccount).toHaveBeenCalledWith({
      email: "agent@example.com",
      password: "strongpass",
      fullName: "Test Agent",
      phone: "+2348031234567",
      ninNumber: null,
      cacNumber: null
    });
  });

  it("rejects invalid CAC before account creation", async () => {
    const response = await POST(agentRegisterRequest({ ninNumber: "", cacNumber: "RC/123" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Enter a valid CAC registration number.");
    expect(mocks.createAgentAccount).not.toHaveBeenCalled();
  });

  it("returns a conflict when CAC already belongs to another agent", async () => {
    mocks.createAgentAccount.mockRejectedValueOnce(new Error("An agent with this CAC registration number already exists."));

    const response = await POST(agentRegisterRequest({ ninNumber: "", cacNumber: "RC1234567" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("An agent with this CAC registration number already exists.");
  });

  it("does not use the async React event target reset pattern in registration forms", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/auth-forms.tsx"), "utf8");

    expect(source).not.toContain("event.currentTarget.reset()");
    expect(source).toContain('redirectToCheckEmail(email, "client", response.checkEmailUrl);');
    expect(source).toContain('redirectToCheckEmail(email, "agent", response.checkEmailUrl);');
  });

  it("checks CAC availability before creating the auth user", () => {
    const source = readFileSync(path.join(process.cwd(), "src/modules/agents/agent.repository.ts"), "utf8");

    expect(source).toContain("async function assertCacAvailable(cacNumber: string)");
    expect(source).toContain('.eq("cac_number", cacNumber)');
    expect(source).toContain("await assertRegistrationAvailable({ email: input.email, ninNumber: input.ninNumber, cacNumber: input.cacNumber });");
    expect(source.indexOf("await assertRegistrationAvailable({ email: input.email")).toBeLessThan(
      source.indexOf("const userId = await createAuthUserWithConfirmation")
    );
    expect(source).toContain("cac_number: input.cacNumber");
  });

  it("remounts auth Turnstile widgets after failed submissions", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/auth-forms.tsx"), "utf8");

    expect(source).toContain("setLoginTurnstileKey((current) => current + 1);");
    expect(source).toContain("setResetTurnstileKey((current) => current + 1);");
    expect(source).toContain("setTurnstileKey((current) => current + 1);");
    expect(source).toContain("key={`login-${loginTurnstileKey}`}");
    expect(source).toContain("key={`password-reset-${resetTurnstileKey}`}");
    expect(source).toContain("key={`client-register-${turnstileKey}`}");
    expect(source).toContain("key={`agent-register-${turnstileKey}`}");
  });

  it("maps agent registration API errors through the friendly auth message helper", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/auth-forms.tsx"), "utf8");

    expect(source).not.toContain("setMessage(error.message);");
    expect(source).toContain(
      'setMessage(getFriendlyAuthMessage(error, "We could not create the agent account. Please try again."));'
    );
  });

  it("keeps Turnstile messages user-friendly and hides diagnostics from auth forms", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/security/turnstile-fields.tsx"), "utf8");

    expect(source).toContain("Security check could not load. Check your connection, then tap retry.");
    expect(source).toContain("Security check expired. Tap retry, then submit the form again.");
    expect(source).toContain("Retry security check");
    expect(source).not.toContain("Code:");
    expect(source).not.toContain("Config check:");
    expect(source).not.toContain("/api/security/turnstile-status");
  });

  it("does not label NIN or CAC verification placeholders as optional", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/forms/auth-forms.tsx"), "utf8");

    expect(source).toContain('placeholder="NIN number"');
    expect(source).toContain('placeholder="CAC registration number"');
    expect(source).not.toContain("NIN number (optional)");
    expect(source).not.toContain("CAC registration number (optional)");
  });

  it("presents NIN and CAC as optional credibility details, not required verification", () => {
    const formSource = readFileSync(path.join(process.cwd(), "src/components/forms/auth-forms.tsx"), "utf8");
    const pageSource = readFileSync(path.join(process.cwd(), "src/app/agents/register/page.tsx"), "utf8");

    expect(formSource).toContain("Credibility details");
    expect(formSource).toContain("NIN or CAC is not required");
    expect(formSource).not.toContain("Provide either your NIN or CAC registration number.");
    expect(pageSource).toContain("Add NIN or CAC details if available to improve your credibility.");
    expect(pageSource).not.toContain("Become a verified agent");
  });
});
