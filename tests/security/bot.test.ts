import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { assertBotProtection } from "../../src/lib/security/bot";

vi.mock("../../src/lib/security/logger", () => ({
  logSecurityEvent: vi.fn()
}));

function request() {
  return new NextRequest("http://localhost:3000/api/test");
}

describe("assertBotProtection", () => {
  it("rejects honeypot submissions", async () => {
    await expect(
      assertBotProtection(
        request(),
        { website: "spam", formStartedAt: Date.now() - 5000 },
        "test"
      )
    ).rejects.toThrow("Request blocked");
  });

  it("rejects forms submitted too quickly", async () => {
    await expect(
      assertBotProtection(
        request(),
        { website: "", formStartedAt: Date.now() },
        "test"
      )
    ).rejects.toThrow("Please wait");
  });
});
