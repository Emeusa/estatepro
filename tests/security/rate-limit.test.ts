import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { RATE_LIMITS, rateLimit } from "../../src/lib/security/rate-limit";

function requestFor(ip: string) {
  return new NextRequest("http://localhost:3000/api/test", {
    headers: { "x-forwarded-for": ip }
  });
}

describe("rateLimit", () => {
  it("uses separate forgiving auth limits for bot checks, login, signup, and reset", () => {
    expect(RATE_LIMITS.authBotCheck).toMatchObject({ name: "auth-bot-check", limit: 30, windowSeconds: 60 });
    expect(RATE_LIMITS.login).toMatchObject({ name: "login", limit: 12, windowSeconds: 300 });
    expect(RATE_LIMITS.clientRegister.name).toBe("client-register");
    expect(RATE_LIMITS.agentRegister.limit).toBe(5);
    expect(RATE_LIMITS.passwordReset.limit).toBe(5);
  });

  it("blocks requests over the configured limit", async () => {
    const policy = { name: `test-${crypto.randomUUID()}`, limit: 1, windowSeconds: 60 };

    const first = await rateLimit(requestFor("203.0.113.10"), policy, "subject");
    const second = await rateLimit(requestFor("203.0.113.10"), policy, "subject");

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    if (!second.allowed) {
      expect(second.response.status).toBe(429);
      expect(second.response.headers.get("X-RateLimit-Limit")).toBe("1");
      await expect(second.response.json()).resolves.toMatchObject({
        error: "Too many requests",
        message: "Too many requests. Please wait a moment and try again.",
        retryAfter: expect.any(Number)
      });
    }
  });
});
