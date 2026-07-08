import { describe, expect, it } from "vitest";

import { getFriendlyAuthMessage } from "../../src/lib/auth-messages";

describe("getFriendlyAuthMessage", () => {
  it("shows a clear email confirmation message", () => {
    expect(getFriendlyAuthMessage(new Error("Email not confirmed"), "fallback")).toBe(
      "Please confirm your email before signing in."
    );
  });
});
