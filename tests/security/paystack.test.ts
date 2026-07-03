import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import { verifyPaystackWebhookSignature } from "../../src/lib/paystack";

describe("verifyPaystackWebhookSignature", () => {
  it("accepts the expected Paystack HMAC signature", () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    const body = JSON.stringify({ event: "charge.success", data: { reference: "C59-test" } });
    const signature = createHmac("sha512", "test-secret").update(body).digest("hex");

    expect(verifyPaystackWebhookSignature(body, signature)).toBe(true);
    expect(verifyPaystackWebhookSignature(body, "bad-signature")).toBe(false);
  });
});
