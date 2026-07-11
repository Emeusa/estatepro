import { describe, expect, it } from "vitest";

import { clientRegistrationSchema } from "../../src/modules/agents/agent.schema";

const basePayload = {
  email: "CLIENT@Example.COM",
  password: "strongpass"
};

describe("clientRegistrationSchema", () => {
  it("accepts blank optional phone values as null", () => {
    expect(clientRegistrationSchema.parse({ ...basePayload, phone: "" }).phone).toBeNull();
    expect(clientRegistrationSchema.parse({ ...basePayload, phone: "   " }).phone).toBeNull();
    expect(clientRegistrationSchema.parse(basePayload).phone).toBeNull();
  });

  it("normalizes a provided phone number", () => {
    expect(clientRegistrationSchema.parse({ ...basePayload, phone: "08031234567" }).phone).toBe("+2348031234567");
  });

  it("rejects non-empty invalid phone text", () => {
    expect(clientRegistrationSchema.safeParse({ ...basePayload, phone: "not a phone" }).success).toBe(false);
  });
});
