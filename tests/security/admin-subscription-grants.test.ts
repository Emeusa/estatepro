import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  getAgentProfile: vi.fn(),
  getUserProfile: vi.fn(),
  insertSubscriptionAdminGrant: vi.fn(),
  reconcileAgentListingsForPlan: vi.fn(),
  syncAgentPlanCredits: vi.fn(),
  upsertManualSubscription: vi.fn()
}));

vi.mock("@/modules/agents/agent.repository", () => ({
  getAgentProfile: mocks.getAgentProfile,
  getUserProfile: mocks.getUserProfile
}));

vi.mock("@/modules/entitlements/entitlement.service", () => ({
  syncAgentPlanCredits: mocks.syncAgentPlanCredits
}));

vi.mock("@/modules/listings/listing.service", () => ({
  enforceAgentActiveListingLimit: vi.fn()
}));

vi.mock("@/modules/listings/listing-plan-reconciliation.service", () => ({
  reconcileAgentListingsForPlan: mocks.reconcileAgentListingsForPlan
}));

vi.mock("@/modules/subscriptions/admin-grant.repository", () => ({
  insertSubscriptionAdminGrant: mocks.insertSubscriptionAdminGrant,
  listSubscriptionAdminGrantsForAgent: vi.fn(),
  upsertManualSubscription: mocks.upsertManualSubscription
}));

import { grantAdminSubscription } from "../../src/modules/subscriptions/admin-grant.service";

const activePrepaidSubscription = {
  agentId: "agent-id",
  planSlug: "starter_agent",
  paymentProvider: "paystack",
  billingMode: "prepaid",
  trialStartsAt: "2026-07-01T00:00:00.000Z",
  trialEndsAt: "2026-08-01T00:00:00.000Z",
  isActive: true,
  status: "active",
  paystackCustomerCode: null,
  paystackSubscriptionCode: null,
  paystackEmailToken: null,
  paystackPlanCode: null,
  opayOrderNo: null,
  opayTransactionId: null,
  currentPeriodStart: "2026-07-01T00:00:00.000Z",
  currentPeriodEnd: "2099-08-01T00:00:00.000Z",
  cancelAtPeriodEnd: false
} as const;

function futureExpiry(days = 90) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe("admin subscription grants", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());

    mocks.getAgentProfile.mockResolvedValue({
      agent: { id: "agent-id", verificationStatus: "approved", isBlocked: false },
      subscription: activePrepaidSubscription
    });
    mocks.getUserProfile.mockResolvedValue({
      id: "agent-id",
      email: "agent@example.com",
      role: "agent"
    });
    mocks.upsertManualSubscription.mockImplementation(async (input) => ({
      ...activePrepaidSubscription,
      planSlug: input.planSlug,
      paymentProvider: "manual",
      billingMode: "prepaid",
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd
    }));
    mocks.insertSubscriptionAdminGrant.mockResolvedValue({
      id: "grant-id",
      agentId: "agent-id",
      adminId: "admin-id",
      planSlug: "agency_plus",
      periodStart: "2026-07-21T00:00:00.000Z",
      periodEnd: "2026-10-19T23:59:59.000Z",
      reason: "Launch promo",
      previousPlanSlug: "starter_agent",
      previousStatus: "active",
      previousPeriodEnd: "2099-08-01T00:00:00.000Z",
      createdAt: "2026-07-21T00:00:00.000Z"
    });
    mocks.reconcileAgentListingsForPlan.mockResolvedValue({
      activatedListings: 2,
      demotedListings: 0,
      activeListingLimit: 750
    });
  });

  it("grants a paid manual promo subscription and syncs credits", async () => {
    const expiresAt = futureExpiry();
    const result = await grantAdminSubscription({
      agentId: "agent-id",
      adminId: "admin-id",
      payload: {
        planSlug: "agency_plus",
        expiresAt,
        reason: "Launch promo"
      }
    });

    expect(result.subscription.planSlug).toBe("agency_plus");
    expect(mocks.upsertManualSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-id",
        planSlug: "agency_plus",
        currentPeriodEnd: expiresAt
      })
    );
    expect(mocks.insertSubscriptionAdminGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin-id",
        previousSubscription: activePrepaidSubscription,
        reason: "Launch promo"
      })
    );
    expect(mocks.syncAgentPlanCredits).toHaveBeenCalledWith("agent-id", result.subscription);
    expect(mocks.reconcileAgentListingsForPlan).toHaveBeenCalledWith("agent-id", result.subscription);
  });

  it("rejects paid promo grants without an expiry date", async () => {
    await expect(
      grantAdminSubscription({
        agentId: "agent-id",
        adminId: "admin-id",
        payload: { planSlug: "growth_agent", reason: "Launch promo" }
      })
    ).rejects.toThrow("Choose an expiry date for this promo plan.");

    expect(mocks.upsertManualSubscription).not.toHaveBeenCalled();
  });

  it("does not overwrite active recurring Paystack subscriptions", async () => {
    mocks.getAgentProfile.mockResolvedValue({
      agent: { id: "agent-id", verificationStatus: "approved", isBlocked: false },
      subscription: {
        ...activePrepaidSubscription,
        paymentProvider: "paystack",
        billingMode: "recurring"
      }
    });

    await expect(
      grantAdminSubscription({
        agentId: "agent-id",
        adminId: "admin-id",
        payload: {
          planSlug: "pro_agent",
          expiresAt: futureExpiry(),
          reason: "Launch promo"
        }
      })
    ).rejects.toMatchObject({
      status: 409
    });

    expect(mocks.upsertManualSubscription).not.toHaveBeenCalled();
  });

  it("allows manual promo grants for active recurring Free Starter subscriptions", async () => {
    mocks.getAgentProfile.mockResolvedValue({
      agent: { id: "agent-id", verificationStatus: "approved", isBlocked: false },
      subscription: {
        ...activePrepaidSubscription,
        planSlug: "free_starter",
        paymentProvider: "paystack",
        billingMode: "recurring"
      }
    });

    const expiresAt = futureExpiry();
    const result = await grantAdminSubscription({
      agentId: "agent-id",
      adminId: "admin-id",
      payload: {
        planSlug: "agency_plus",
        expiresAt,
        reason: "Launch promo"
      }
    });

    expect(result.subscription.planSlug).toBe("agency_plus");
    expect(mocks.upsertManualSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-id",
        planSlug: "agency_plus",
        currentPeriodEnd: expiresAt
      })
    );
    expect(mocks.syncAgentPlanCredits).toHaveBeenCalledWith("agent-id", result.subscription);
  });

  it("rejects excessive promo durations", async () => {
    await expect(
      grantAdminSubscription({
        agentId: "agent-id",
        adminId: "admin-id",
        payload: {
          planSlug: "pro_agent",
          expiresAt: futureExpiry(366),
          reason: "Launch promo"
        }
      })
    ).rejects.toThrow("Promo grants cannot exceed 365 days.");

    expect(mocks.upsertManualSubscription).not.toHaveBeenCalled();
  });

  it("resets to Free Starter without paid credit sync", async () => {
    const result = await grantAdminSubscription({
      agentId: "agent-id",
      adminId: "admin-id",
      payload: { planSlug: "free_starter", reason: "Manual reset" }
    });

    expect(result.subscription.planSlug).toBe("free_starter");
    expect(mocks.upsertManualSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        planSlug: "free_starter",
        currentPeriodEnd: null
      })
    );
    expect(mocks.syncAgentPlanCredits).not.toHaveBeenCalled();
    expect(mocks.reconcileAgentListingsForPlan).toHaveBeenCalledWith("agent-id", result.subscription);
  });
});

describe("admin promo grant UI guard", () => {
  it("guards only active paid recurring Paystack subscriptions", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/agents/[agentId]/page.tsx"), "utf8");

    expect(source).toContain("hasActivePaidRecurringPaystack");
    expect(source).toContain("isPaidPricingPlanSlug(currentSubscription.planSlug)");
    expect(source).not.toContain("const hasActiveRecurringPaystack");
  });
});
