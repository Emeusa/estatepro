import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import { createOpayRequestSignature, verifyOpayCallbackSignature } from "../../src/lib/opay";

describe("OPay signatures", () => {
  it("creates request signatures with the private key", () => {
    process.env.OPAY_PRIVATE_KEY = "opay-private";
    const body = JSON.stringify({ country: "NG", reference: "C59-test" });
    const expected = createHmac("sha512", "opay-private").update(body).digest("hex");

    expect(createOpayRequestSignature(body)).toBe(expected);
  });

  it("validates callback signatures without accepting tampered payloads", () => {
    process.env.OPAY_PRIVATE_KEY = "opay-private";
    const payload = {
      amount: { currency: "NGN", total: 1490000 },
      country: "NG",
      reference: "C59-test",
      status: "SUCCESS",
      transactionId: "TXN-1"
    };
    const signatureBase = "NGN1490000NGC59-testSUCCESSTXN-1";
    const sha512 = createHmac("sha3-512", "opay-private").update(signatureBase).digest("hex");

    expect(verifyOpayCallbackSignature({ payload, sha512 })).toBe(true);
    expect(verifyOpayCallbackSignature({ payload: { ...payload, status: "FAILED" }, sha512 })).toBe(false);
  });
});
