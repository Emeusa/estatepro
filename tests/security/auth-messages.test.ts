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

  it("shows context-specific rate-limit messages", () => {
    const error = new Error("Too many requests. Please wait a moment and try again.");

    expect(getFriendlyAuthMessage(error, "fallback", "login")).toBe(
      "Too many login attempts. Please wait a moment and try again."
    );
    expect(getFriendlyAuthMessage(error, "fallback", "register")).toBe(
      "Too many signup attempts. Please wait a moment and try again."
    );
    expect(getFriendlyAuthMessage(error, "fallback", "passwordReset")).toBe(
      "Too many password reset requests. Please wait a moment and try again."
    );
    expect(getFriendlyAuthMessage(error, "fallback")).toBe("Too many requests. Please wait a moment and try again.");
  });

  it("shows a clear security-check loading message", () => {
    expect(
      getFriendlyAuthMessage(
        new Error("Security check is still loading. Wait a few seconds, then try again."),
        "fallback"
      )
    ).toBe("Security check is still loading. Wait a few seconds, then try again.");
  });

  it("maps expired or failed security-check errors to a refresh instruction", () => {
    expect(getFriendlyAuthMessage(new Error("Security verification failed. Please refresh and try again."), "fallback")).toBe(
      "Security check needs a refresh. Tap retry on the security check, then try again."
    );
    expect(getFriendlyAuthMessage(new Error("Turnstile token expired"), "fallback")).toBe(
      "Security check needs a refresh. Tap retry on the security check, then try again."
    );
    expect(getFriendlyAuthMessage(new Error("Security check expired. Tap retry, then submit again."), "fallback")).toBe(
      "Security check needs a refresh. Tap retry on the security check, then try again."
    );
  });

  it("shows a connection-focused message when the security check script cannot load", () => {
    expect(
      getFriendlyAuthMessage(
        new Error("Security check could not load. Check your connection, then tap retry."),
        "fallback"
      )
    ).toBe("Security check could not load. Check your connection, tap retry, and try again.");
  });

  it("shows a support message for incomplete profiles", () => {
    expect(getFriendlyAuthMessage(new Error("Account profile was not found."), "fallback")).toBe(
      "Your account exists, but the profile is incomplete. Please contact support."
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
