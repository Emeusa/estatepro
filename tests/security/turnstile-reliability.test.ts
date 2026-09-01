import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyTurnstile } from "../../src/lib/security/turnstile";

function request() {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    headers: { "x-forwarded-for": "203.0.113.20" }
  });
}

function readBody(call: unknown[]) {
  const options = call[1] as RequestInit;
  return options.body as URLSearchParams;
}

describe("Turnstile verification reliability", () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it("retries a transient server failure once with the same idempotency key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile(request(), "valid-token")).resolves.toEqual({ success: true, skipped: false });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readBody(fetchMock.mock.calls[0]).get("idempotency_key")).toBeTruthy();
    expect(readBody(fetchMock.mock.calls[1]).get("idempotency_key")).toBe(
      readBody(fetchMock.mock.calls[0]).get("idempotency_key")
    );
  });

  it("retries Cloudflare internal errors but not invalid tokens", async () => {
    const internalFetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ success: false, "error-codes": ["internal-error"] }))
      .mockResolvedValueOnce(Response.json({ success: true }));
    vi.stubGlobal("fetch", internalFetch);

    await expect(verifyTurnstile(request(), "valid-token")).resolves.toEqual({ success: true, skipped: false });
    expect(internalFetch).toHaveBeenCalledTimes(2);

    const invalidFetch = vi.fn().mockResolvedValue(
      Response.json({ success: false, "error-codes": ["invalid-input-response"] })
    );
    vi.stubGlobal("fetch", invalidFetch);

    await expect(verifyTurnstile(request(), "invalid-token")).resolves.toMatchObject({
      success: false,
      category: "invalid_token"
    });
    expect(invalidFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry expired or missing tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile(request(), "expired-token")).resolves.toEqual({
      success: false,
      message: "Security check expired. Tap retry, then submit again.",
      category: "expired_token"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(verifyTurnstile(request(), "")).resolves.toMatchObject({
      success: false,
      category: "missing_token"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries one network failure and returns a sanitized category after a second failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("socket details must stay private"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile(request(), "valid-token")).resolves.toEqual({
      success: false,
      message: "Security check could not be reached. Check your connection, tap retry, and try again.",
      category: "cloudflare_unavailable"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
