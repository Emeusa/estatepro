import { describe, expect, it } from "vitest";

import {
  getPlanAnalyticsLevel,
  getPlanFeatureRows,
  getPlanRank,
  getPricingPlan,
  hasPriorityReview,
  hasPrioritySupport,
  isHigherPlan,
  isLowerPlan
} from "../../src/lib/pricing";

describe("pricing plan ranking", () => {
  it("orders paid plans for upgrade and downgrade checks", () => {
    expect(getPlanRank("free_starter")).toBe(0);
    expect(getPlanRank("starter_agent")).toBeLessThan(getPlanRank("growth_agent"));
    expect(isLowerPlan("growth_agent", "starter_agent")).toBe(true);
    expect(isHigherPlan("growth_agent", "pro_agent")).toBe(true);
    expect(isLowerPlan("growth_agent", "agency_plus")).toBe(false);
  });

  it("makes higher plan benefits cumulative", () => {
    const agencyFeatures = getPlanFeatureRows(getPricingPlan("agency_plus")).map((feature) => feature.key);

    expect(agencyFeatures).toContain("basic-analytics");
    expect(agencyFeatures).toContain("priority-review");
    expect(agencyFeatures).toContain("advanced-analytics");
    expect(agencyFeatures).toContain("priority-support");
    expect(getPlanAnalyticsLevel("free_starter")).toBe("none");
    expect(getPlanAnalyticsLevel("starter_agent")).toBe("basic");
    expect(getPlanAnalyticsLevel("pro_agent")).toBe("advanced");
    expect(hasPriorityReview("growth_agent")).toBe(true);
    expect(hasPrioritySupport("agency_plus")).toBe(true);
    expect(hasPrioritySupport("pro_agent")).toBe(false);
  });
});
