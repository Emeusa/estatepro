import { describe, expect, it } from "vitest";

import { getPlanRank, isHigherPlan, isLowerPlan } from "../../src/lib/pricing";

describe("pricing plan ranking", () => {
  it("orders paid plans for upgrade and downgrade checks", () => {
    expect(getPlanRank("free_starter")).toBe(0);
    expect(getPlanRank("starter_agent")).toBeLessThan(getPlanRank("growth_agent"));
    expect(isLowerPlan("growth_agent", "starter_agent")).toBe(true);
    expect(isHigherPlan("growth_agent", "pro_agent")).toBe(true);
    expect(isLowerPlan("growth_agent", "agency_plus")).toBe(false);
  });
});
