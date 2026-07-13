import { describe, expect, it } from "vitest";

import { getAgentDisplayName, normalizeBusinessName } from "../../src/lib/agent-display";
import { toAgentProfile } from "../../src/lib/supabase-mappers";
import { userProfileSchema } from "../../src/modules/agents/agent.schema";

describe("agent business name", () => {
  it("preserves brand casing while sanitizing unsafe characters", () => {
    expect(normalizeBusinessName("  PCL HOMES  ")).toBe("PCL HOMES");
    expect(normalizeBusinessName("Trust <Estate>")).toBe("Trust Estate");
  });

  it("uses business name for public display and falls back to full name", () => {
    expect(getAgentDisplayName("John Agent", "PCL HOMES")).toBe("PCL HOMES");
    expect(getAgentDisplayName("John Agent", "   ")).toBe("John Agent");
    expect(getAgentDisplayName("John Agent", null)).toBe("John Agent");
  });

  it("accepts blank optional business name and rejects too-short names", () => {
    expect(userProfileSchema.parse({ fullName: "John Agent", phone: "", businessName: "" }).businessName).toBeNull();
    expect(userProfileSchema.parse({ fullName: "John Agent", phone: "", businessName: "PCL HOMES" }).businessName).toBe(
      "PCL HOMES"
    );
    expect(userProfileSchema.safeParse({ fullName: "John Agent", phone: "", businessName: "A" }).success).toBe(false);
  });

  it("maps nullable agent business names from Supabase rows", () => {
    expect(
      toAgentProfile({
        id: "agent-id",
        verification_status: "approved",
        business_name: "PCL HOMES",
        nin_number: "12345678901",
        is_blocked: false,
        trial_ends_at: "2026-08-01T00:00:00.000Z"
      }).businessName
    ).toBe("PCL HOMES");
  });
});
