import { describe, expect, it } from "vitest";

import {
  buildCheckEmailUrl,
  getLoginConfirmationMessage,
  getPasswordResetCompleteMessage
} from "../../src/lib/auth-confirmation";
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

  it("maps password reset query state to a success notice", () => {
    expect(getPasswordResetCompleteMessage("1")).toBe("Password updated. You can now sign in.");
    expect(getPasswordResetCompleteMessage("0")).toBeNull();
    expect(getPasswordResetCompleteMessage(null)).toBeNull();
  });

  it("builds a confirmation page URL with email state", () => {
    expect(buildCheckEmailUrl("USER@Example.COM", "agent")).toBe(
      "/auth/check-email?email=user%40example.com&type=agent"
    );
  });
});
