import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { rateLimit } from "../../src/lib/security/rate-limit";

function requestFor(ip: string) {
  return new NextRequest("http://localhost:3000/api/test", {
    headers: { "x-forwarded-for": ip }
  });
}

describe("rateLimit", () => {
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
