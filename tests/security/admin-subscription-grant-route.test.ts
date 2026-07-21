import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  grantAdminSubscription: vi.fn(),
  logSecurityEvent: vi.fn(),
  rateLimit: vi.fn(),
  requireAdmin: vi.fn(),
  withRateLimitHeaders: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) {
      super(message);
    }
  },
  requireAdmin: mocks.requireAdmin
}));

vi.mock("@/lib/security/logger", () => ({
  captureServerError: mocks.captureServerError,
  logSecurityEvent: mocks.logSecurityEvent
}));

vi.mock("@/lib/security/rate-limit", () => ({
  RATE_LIMITS: {
    admin: { name: "admin", limit: 60, windowSeconds: 60 }
  },
  rateLimit: mocks.rateLimit,
  withRateLimitHeaders: mocks.withRateLimitHeaders
}));

vi.mock("@/modules/subscriptions/admin-grant.service", () => ({
  AdminSubscriptionGrantError: class AdminSubscriptionGrantError extends Error {
    constructor(message: string, public status = 400) {
      super(message);
    }
  },
  grantAdminSubscription: mocks.grantAdminSubscription
}));

import { AuthError } from "../../src/lib/auth";
import { POST } from "../../src/app/api/admin/agents/[agentId]/subscription-grant/route";

function grantRequest() {
  return new NextRequest("http://localhost:3000/api/admin/agents/agent-id/subscription-grant", {
    method: "POST",
    body: JSON.stringify({
      planSlug: "agency_plus",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      reason: "Launch promo"
    })
  });
}

describe("admin subscription grant route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());

    mocks.requireAdmin.mockResolvedValue({
      uid: "admin-id",
      id: "admin-id",
      email: "admin@example.com",
      role: "admin"
    });
    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
    mocks.withRateLimitHeaders.mockImplementation((response: NextResponse) => response);
    mocks.grantAdminSubscription.mockResolvedValue({
      subscription: {
        agentId: "agent-id",
        planSlug: "agency_plus",
        paymentProvider: "manual",
        billingMode: "prepaid",
        currentPeriodEnd: "2026-10-19T23:59:59.000Z"
      },
      grant: { id: "grant-id", agentId: "agent-id", planSlug: "agency_plus" }
    });
  });

  it("requires admin access before granting a subscription", async () => {
    mocks.requireAdmin.mockRejectedValue(new AuthError("Insufficient permissions", 403));

    const response = await POST(grantRequest(), { params: Promise.resolve({ agentId: "agent-id" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe("Insufficient permissions");
    expect(mocks.grantAdminSubscription).not.toHaveBeenCalled();
  });

  it("grants the subscription and logs the admin action", async () => {
    const response = await POST(grantRequest(), { params: Promise.resolve({ agentId: "agent-id" }) });

    expect(response.status).toBe(200);
    expect(mocks.grantAdminSubscription).toHaveBeenCalledWith({
      agentId: "agent-id",
      adminId: "admin-id",
      payload: expect.objectContaining({
        planSlug: "agency_plus",
        reason: "Launch promo"
      })
    });
    expect(mocks.logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_subscription_grant",
        result: "success",
        userId: "admin-id",
        metadata: expect.objectContaining({
          agentId: "agent-id",
          planSlug: "agency_plus"
        })
      })
    );
  });
});
