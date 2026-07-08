import { describe, expect, it } from "vitest";

import { getLoginConfirmationMessage } from "../../src/lib/auth-confirmation";
import { getFriendlyAuthMessage } from "../../src/lib/auth-messages";

describe("getFriendlyAuthMessage", () => {
  it("shows a clear email confirmation message", () => {
    expect(getFriendlyAuthMessage(new Error("Email not confirmed"), "fallback")).toBe(
      "Please confirm your email before signing in."
    );
  });

  it("shows a useful duplicate email message", () => {
    expect(getFriendlyAuthMessage(new Error("User already registered"), "fallback")).toBe(
      "An account with this email already exists. Please log in or reset your password."
    );
  });

  it("maps confirmed login query state to a success notice", () => {
    expect(getLoginConfirmationMessage("1")).toBe("Email confirmed. You can now sign in.");
    expect(getLoginConfirmationMessage("0")).toBeNull();
    expect(getLoginConfirmationMessage(null)).toBeNull();
  });
});
