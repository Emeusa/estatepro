import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import { PAYSTACK_PREPAID_CHANNELS, verifyPaystackWebhookSignature } from "../../src/lib/paystack";

describe("verifyPaystackWebhookSignature", () => {
  it("accepts the expected Paystack HMAC signature", () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    const body = JSON.stringify({ event: "charge.success", data: { reference: "C59-test" } });
    const signature = createHmac("sha512", "test-secret").update(body).digest("hex");

    expect(verifyPaystackWebhookSignature(body, signature)).toBe(true);
    expect(verifyPaystackWebhookSignature(body, "bad-signature")).toBe(false);
  });
});

describe("PAYSTACK_PREPAID_CHANNELS", () => {
  it("allows no-card Paystack payment channels for prepaid checkout", () => {
    expect(PAYSTACK_PREPAID_CHANNELS).toEqual(["bank_transfer", "ussd", "bank"]);
  });
});
