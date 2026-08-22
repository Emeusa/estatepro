import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  getAgentAnalytics: vi.fn(),
  getAgentDashboardData: vi.fn(),
  getAgentEntitlements: vi.fn(),
  getAgentListingSummary: vi.fn(),
  getAgentListings: vi.fn(),
  getUserAccount: vi.fn(),
  isBillingLiveEnabled: vi.fn(),
  rateLimit: vi.fn(),
  requireAgent: vi.fn(),
  withRateLimitHeaders: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {
    status = 401;
  },
  requireAgent: mocks.requireAgent
}));

vi.mock("@/lib/billing-config", () => ({
  isBillingLiveEnabled: mocks.isBillingLiveEnabled
}));

vi.mock("@/lib/security/logger", () => ({
  captureServerError: mocks.captureServerError
}));

vi.mock("@/lib/security/rate-limit", () => ({
  RATE_LIMITS: {
    userApi: { name: "user-api", limit: 90, windowSeconds: 60 }
  },
  rateLimit: mocks.rateLimit,
  withRateLimitHeaders: mocks.withRateLimitHeaders
}));

vi.mock("@/modules/analytics/analytics.service", () => ({
  getAgentAnalytics: mocks.getAgentAnalytics
}));

vi.mock("@/modules/agents/agent.service", () => ({
  getAgentDashboardData: mocks.getAgentDashboardData,
  getUserAccount: mocks.getUserAccount
}));

vi.mock("@/modules/entitlements/entitlement.service", () => ({
  getAgentEntitlements: mocks.getAgentEntitlements
}));

vi.mock("@/modules/listings/listing.service", () => ({
  getAgentListingSummary: mocks.getAgentListingSummary,
  getAgentListings: mocks.getAgentListings
}));

import { GET } from "../../src/app/api/agents/me/route";

const subscription = {
  agentId: "agent-id",
  planSlug: "starter_agent",
  paymentProvider: "paystack",
  billingMode: "prepaid",
  trialStartsAt: new Date().toISOString(),
  trialEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
  isActive: true,
  status: "active",
  paystackCustomerCode: null,
  paystackSubscriptionCode: null,
  paystackEmailToken: null,
  paystackPlanCode: null,
  opayOrderNo: null,
  opayTransactionId: null,
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 86_400_000).toISOString(),
  cancelAtPeriodEnd: false
};

function request(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

describe("/api/agents/me", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());

    mocks.requireAgent.mockResolvedValue({
      uid: "agent-id",
      id: "agent-id",
      email: "agent@example.com",
      role: "agent"
    });
    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
    mocks.withRateLimitHeaders.mockImplementation((response: NextResponse) => response);
    mocks.getAgentDashboardData.mockResolvedValue({
      agent: { verificationStatus: "approved", isBlocked: false },
      subscription
    });
    mocks.getUserAccount.mockResolvedValue({ id: "agent-id", email: "agent@example.com", role: "agent" });
    mocks.getAgentListings.mockResolvedValue([]);
    mocks.getAgentListingSummary.mockResolvedValue({ total: 12, active: 9, pending: 2, unavailable: 1 });
    mocks.getAgentEntitlements.mockResolvedValue({ planSlug: "starter_agent" });
    mocks.getAgentAnalytics.mockResolvedValue({ range: "30d", analyticsLevel: "basic", totals: {}, listings: [] });
    mocks.isBillingLiveEnabled.mockReturnValue(true);
  });

  it("skips optional dashboard sections when query flags disable them", async () => {
    const response = await GET(
      request("/api/agents/me?listLimit=0&includeEntitlements=false&includeAnalytics=false")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.listings).toEqual([]);
    expect(body.entitlements).toBeUndefined();
    expect(body.analytics).toBeUndefined();
    expect(mocks.getAgentListings).toHaveBeenCalledWith("agent-id", 0);
    expect(mocks.getAgentEntitlements).not.toHaveBeenCalled();
    expect(mocks.getAgentAnalytics).not.toHaveBeenCalled();
    expect(mocks.getAgentListingSummary).not.toHaveBeenCalled();
  });

  it("passes list limits and loaded subscription context to expensive sections", async () => {
    const response = await GET(request("/api/agents/me?listLimit=3"));

    expect(response.status).toBe(200);
    expect(mocks.getAgentListings).toHaveBeenCalledWith("agent-id", 3);
    expect(mocks.getAgentEntitlements).toHaveBeenCalledWith("agent-id", subscription);
    expect(mocks.getAgentAnalytics).toHaveBeenCalledWith("agent-id", "30d", subscription);
  });

  it("returns a complete listing summary independently of the recent-listing limit", async () => {
    const response = await GET(
      request(
        "/api/agents/me?listLimit=3&includeListingSummary=true&includeEntitlements=false&includeAnalytics=false"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getAgentListings).toHaveBeenCalledWith("agent-id", 3);
    expect(mocks.getAgentListingSummary).toHaveBeenCalledWith("agent-id");
    expect(body.listingSummary).toEqual({ total: 12, active: 9, pending: 2, unavailable: 1 });
  });
});
