import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SubscriptionRecord } from "../../src/lib/types";

const mocks = vi.hoisted(() => ({
  demoteExcessActiveAvailableListingsForAgent: vi.fn(),
  getAgentProfile: vi.fn(),
  reactivateEligiblePlanLimitedListingsForAgent: vi.fn()
}));

vi.mock("@/modules/agents/agent.repository", () => ({
  getAgentProfile: mocks.getAgentProfile
}));

vi.mock("@/modules/listings/listing.repository", () => ({
  demoteExcessActiveAvailableListingsForAgent: mocks.demoteExcessActiveAvailableListingsForAgent,
  reactivateEligiblePlanLimitedListingsForAgent: mocks.reactivateEligiblePlanLimitedListingsForAgent
}));

import { reconcileAgentListingsForPlan } from "../../src/modules/listings/listing-plan-reconciliation.service";

const starterSubscription = {
  agentId: "agent-id",
  planSlug: "starter_agent",
  paymentProvider: "paystack",
  billingMode: "recurring",
  isActive: true,
  status: "active",
  currentPeriodEnd: "2099-08-09T00:00:00.000Z"
} as SubscriptionRecord;

describe("listing plan reconciliation", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAgentProfile.mockResolvedValue({
      agent: { verificationStatus: "approved", isBlocked: false },
      subscription: starterSubscription
    });
    mocks.demoteExcessActiveAvailableListingsForAgent.mockResolvedValue({
      demotedListings: 0,
      activeListingLimit: 20
    });
    mocks.reactivateEligiblePlanLimitedListingsForAgent.mockResolvedValue(7);
  });

  it("demotes overflow first and fills newly available plan capacity", async () => {
    const result = await reconcileAgentListingsForPlan("agent-id", starterSubscription);

    expect(mocks.demoteExcessActiveAvailableListingsForAgent).toHaveBeenCalledWith("agent-id", 20);
    expect(mocks.reactivateEligiblePlanLimitedListingsForAgent).toHaveBeenCalledWith("agent-id", 20);
    expect(result).toEqual({ activatedListings: 7, demotedListings: 0, activeListingLimit: 20 });
    expect(
      mocks.demoteExcessActiveAvailableListingsForAgent.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.reactivateEligiblePlanLimitedListingsForAgent.mock.invocationCallOrder[0]);
  });

  it("does not auto-reactivate listings for blocked or unapproved agents", async () => {
    mocks.getAgentProfile.mockResolvedValue({
      agent: { verificationStatus: "pending", isBlocked: false },
      subscription: starterSubscription
    });

    const result = await reconcileAgentListingsForPlan("agent-id", starterSubscription);

    expect(result.activatedListings).toBe(0);
    expect(mocks.reactivateEligiblePlanLimitedListingsForAgent).not.toHaveBeenCalled();
    expect(mocks.demoteExcessActiveAvailableListingsForAgent).toHaveBeenCalled();
  });

  it("wires successful plan changes and maintenance retries to reconciliation", () => {
    const billing = fs.readFileSync(path.join(process.cwd(), "src/modules/billing/billing.service.ts"), "utf8");
    const grants = fs.readFileSync(
      path.join(process.cwd(), "src/modules/subscriptions/admin-grant.service.ts"),
      "utf8"
    );
    const maintenance = fs.readFileSync(
      path.join(process.cwd(), "src/modules/entitlements/auto-refresh.service.ts"),
      "utf8"
    );

    expect(billing).toContain('"paystack_transaction_verification"');
    expect(billing).toContain('"paystack_subscription_webhook"');
    expect(billing).toContain("captureServerError(error");
    expect(grants).toContain("reconcileAgentListingsForPlan(input.agentId, nextSubscription)");
    expect(maintenance).toContain("reconcileAgentListingsForPlan(subscription.agentId, subscription)");
    expect(maintenance).toContain("reactivated += limitResult.activatedListings");
  });
});
