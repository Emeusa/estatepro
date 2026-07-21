import { describe, expect, it } from "vitest";

import { agentRegistrationSchema, clientRegistrationSchema } from "../../src/modules/agents/agent.schema";

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

const baseAgentPayload = {
  email: "AGENT@Example.COM",
  password: "strongpass",
  fullName: "Test Agent",
  phone: "08031234567"
};

describe("agentRegistrationSchema", () => {
  it("accepts NIN-only agent verification", () => {
    const parsed = agentRegistrationSchema.parse({
      ...baseAgentPayload,
      ninNumber: "12345678901",
      cacNumber: ""
    });

    expect(parsed.ninNumber).toBe("12345678901");
    expect(parsed.cacNumber).toBeNull();
  });

  it("accepts CAC-only agent verification and normalizes it", () => {
    const parsed = agentRegistrationSchema.parse({
      ...baseAgentPayload,
      ninNumber: "",
      cacNumber: " rc 1234567 "
    });

    expect(parsed.ninNumber).toBeNull();
    expect(parsed.cacNumber).toBe("RC1234567");
  });

  it("requires either NIN or CAC for agent verification", () => {
    const parsed = agentRegistrationSchema.safeParse({
      ...baseAgentPayload,
      ninNumber: "",
      cacNumber: ""
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid non-empty CAC values", () => {
    const parsed = agentRegistrationSchema.safeParse({
      ...baseAgentPayload,
      ninNumber: "",
      cacNumber: "RC/123"
    });

    expect(parsed.success).toBe(false);
  });
});
