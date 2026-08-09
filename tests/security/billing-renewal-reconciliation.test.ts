import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SubscriptionRecord } from "../../src/lib/types";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  createBillingTransaction: vi.fn(),
  enforceAgentActiveListingLimit: vi.fn(),
  getBillingTransactionByReference: vi.fn(),
  getAgentProfile: vi.fn(),
  getSubscriptionByAgentId: vi.fn(),
  getSubscriptionByPaystackCustomerCode: vi.fn(),
  getSubscriptionByPaystackSubscriptionCode: vi.fn(),
  markBillingTransactionFailed: vi.fn(),
  markBillingTransactionSuccess: vi.fn(),
  reconcileAgentListingsForPlan: vi.fn(),
  revalidateListingMutationPaths: vi.fn(),
  sendSubscriptionActivatedEmail: vi.fn(),
  sendSubscriptionCancelledEmail: vi.fn(),
  sendSubscriptionFailedEmail: vi.fn(),
  syncAgentPlanCredits: vi.fn(),
  updateBillingTransactionInitialized: vi.fn(),
  upsertActiveSubscription: vi.fn(),
  updateSubscriptionBillingState: vi.fn()
}));

vi.mock("@/lib/security/logger", () => ({
  captureServerError: mocks.captureServerError
}));

vi.mock("@/modules/agents/agent.repository", () => ({
  getAgentProfile: mocks.getAgentProfile
}));

vi.mock("@/modules/billing/billing.repository", () => ({
  createBillingTransaction: mocks.createBillingTransaction,
  getBillingTransactionByReference: mocks.getBillingTransactionByReference,
  getSubscriptionByAgentId: mocks.getSubscriptionByAgentId,
  getSubscriptionByPaystackCustomerCode: mocks.getSubscriptionByPaystackCustomerCode,
  getSubscriptionByPaystackSubscriptionCode: mocks.getSubscriptionByPaystackSubscriptionCode,
  markBillingTransactionFailed: mocks.markBillingTransactionFailed,
  markBillingTransactionSuccess: mocks.markBillingTransactionSuccess,
  updateBillingTransactionInitialized: mocks.updateBillingTransactionInitialized,
  upsertActiveSubscription: mocks.upsertActiveSubscription,
  updateSubscriptionBillingState: mocks.updateSubscriptionBillingState
}));

vi.mock("@/modules/email/email.service", () => ({
  sendSubscriptionActivatedEmail: mocks.sendSubscriptionActivatedEmail,
  sendSubscriptionCancelledEmail: mocks.sendSubscriptionCancelledEmail,
  sendSubscriptionFailedEmail: mocks.sendSubscriptionFailedEmail
}));

vi.mock("@/modules/entitlements/entitlement.service", () => ({
  syncAgentPlanCredits: mocks.syncAgentPlanCredits
}));

vi.mock("@/modules/listings/listing-cache", () => ({
  revalidateListingMutationPaths: mocks.revalidateListingMutationPaths
}));

vi.mock("@/modules/listings/listing-plan-reconciliation.service", () => ({
  reconcileAgentListingsForPlan: mocks.reconcileAgentListingsForPlan
}));

vi.mock("@/modules/listings/listing.service", () => ({
  enforceAgentActiveListingLimit: mocks.enforceAgentActiveListingLimit
}));

import { processPaystackWebhook } from "../../src/modules/billing/billing.service";

const expiredSubscription: SubscriptionRecord = {
  agentId: "agent-id",
  planSlug: "starter_agent",
  paymentProvider: "paystack",
  billingMode: "recurring",
  trialStartsAt: "2026-07-01T00:00:00.000Z",
  trialEndsAt: "2026-08-01T00:00:00.000Z",
  isActive: false,
  status: "inactive",
  paystackCustomerCode: "CUS_test",
  paystackSubscriptionCode: "SUB_test",
  paystackEmailToken: "email-token",
  paystackPlanCode: "PLN_test",
  opayOrderNo: null,
  opayTransactionId: null,
  currentPeriodStart: "2026-07-01T00:00:00.000Z",
  currentPeriodEnd: "2026-08-01T00:00:00.000Z",
  cancelAtPeriodEnd: false
};

const renewedSubscription: SubscriptionRecord = {
  ...expiredSubscription,
  isActive: true,
  status: "active",
  currentPeriodStart: "2026-08-09T00:00:00.000Z",
  currentPeriodEnd: "2026-09-09T00:00:00.000Z"
};

describe("Paystack renewal listing reconciliation", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getSubscriptionByPaystackSubscriptionCode.mockResolvedValue(expiredSubscription);
    mocks.getSubscriptionByAgentId.mockResolvedValue(expiredSubscription);
    mocks.updateSubscriptionBillingState.mockResolvedValue(renewedSubscription);
    mocks.syncAgentPlanCredits.mockResolvedValue(undefined);
    mocks.reconcileAgentListingsForPlan.mockResolvedValue({
      activatedListings: 7,
      demotedListings: 0,
      activeListingLimit: 20
    });
  });

  it("reactivates eligible listings after a successful recurring invoice", async () => {
    await processPaystackWebhook({
      event: "invoice.update",
      data: {
        status: "success",
        paid: true,
        period_start: "2026-08-09T00:00:00.000Z",
        period_end: "2026-09-09T00:00:00.000Z",
        subscription: { subscription_code: "SUB_test" }
      }
    });

    expect(mocks.updateSubscriptionBillingState).toHaveBeenCalledWith("agent-id", {
      status: "active",
      isActive: true,
      cancelAtPeriodEnd: false,
      currentPeriodStart: "2026-08-09T00:00:00.000Z",
      currentPeriodEnd: "2026-09-09T00:00:00.000Z"
    });
    expect(mocks.syncAgentPlanCredits).toHaveBeenCalledWith("agent-id", renewedSubscription);
    expect(mocks.reconcileAgentListingsForPlan).toHaveBeenCalledWith("agent-id", renewedSubscription);
    expect(mocks.revalidateListingMutationPaths).toHaveBeenCalled();
  });

  it("does not activate anything for an unpaid invoice update", async () => {
    await processPaystackWebhook({
      event: "invoice.update",
      data: {
        status: "failed",
        paid: false,
        subscription: { subscription_code: "SUB_test" }
      }
    });

    expect(mocks.updateSubscriptionBillingState).not.toHaveBeenCalled();
    expect(mocks.reconcileAgentListingsForPlan).not.toHaveBeenCalled();
  });

  it("keeps renewal processing successful when listing reconciliation fails", async () => {
    mocks.reconcileAgentListingsForPlan.mockRejectedValue(new Error("temporary listing failure"));

    await expect(
      processPaystackWebhook({
        event: "invoice.update",
        data: {
          status: "success",
          paid: true,
          period_start: "2026-08-09T00:00:00.000Z",
          period_end: "2026-09-09T00:00:00.000Z",
          subscription: { subscription_code: "SUB_test" }
        }
      })
    ).resolves.toBeUndefined();

    expect(mocks.captureServerError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: "listing_plan_reconciliation" })
    );
  });
});
