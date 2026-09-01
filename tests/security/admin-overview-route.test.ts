import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  getAdminOverviewStats: vi.fn(),
  getPaidPlanStatsForAdmin: vi.fn(),
  getReportStatsForAdmin: vi.fn(),
  listAdminNotifications: vi.fn(),
  listSupportRequestsForAdmin: vi.fn(),
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

vi.mock("@/lib/security/logger", () => ({ captureServerError: mocks.captureServerError }));
vi.mock("@/lib/security/rate-limit", () => ({
  RATE_LIMITS: { admin: { name: "admin" } },
  rateLimit: mocks.rateLimit,
  withRateLimitHeaders: mocks.withRateLimitHeaders
}));
vi.mock("@/modules/agents/agent.service", () => ({
  getAdminOverviewStats: mocks.getAdminOverviewStats,
  getPaidPlanStatsForAdmin: mocks.getPaidPlanStatsForAdmin
}));
vi.mock("@/modules/support/support.service", () => ({
  listSupportRequestsForAdmin: mocks.listSupportRequestsForAdmin
}));
vi.mock("@/modules/reports/report.service", () => ({
  getReportStatsForAdmin: mocks.getReportStatsForAdmin,
  listAdminNotifications: mocks.listAdminNotifications
}));

import { GET } from "../../src/app/api/admin/overview/route";

function request() {
  return new NextRequest("http://localhost:3000/api/admin/overview");
}

describe("admin overview route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireAdmin.mockResolvedValue({ uid: "admin-id" });
    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
    mocks.withRateLimitHeaders.mockImplementation((response: NextResponse) => response);
    mocks.getAdminOverviewStats.mockResolvedValue({
      totalAgents: 11,
      approvedAgents: 8,
      activeListings: 31,
      unapprovedAgents: 3
    });
    mocks.listSupportRequestsForAdmin.mockResolvedValue([]);
    mocks.getPaidPlanStatsForAdmin.mockResolvedValue({
      totalPaidAgents: 2,
      starterAgent: 1,
      growthAgent: 1,
      proAgent: 0,
      agencyPlus: 0
    });
    mocks.getReportStatsForAdmin.mockResolvedValue({
      openReports: 0,
      highRiskReports: 0,
      needsReview: 0,
      recentReports: []
    });
    mocks.listAdminNotifications.mockResolvedValue([]);
  });

  it("returns authoritative stats without loading full agent reviews", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toEqual({
      totalAgents: 11,
      approvedAgents: 8,
      activeListings: 31,
      unapprovedAgents: 3
    });
    expect(body.degradedSections).toEqual([]);
  });

  it("keeps core stats available when an optional section fails", async () => {
    mocks.getReportStatsForAdmin.mockRejectedValue(new Error("reports temporarily unavailable"));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.activeListings).toBe(31);
    expect(body.degradedSections).toEqual(["reportStats"]);
    expect(body.reportStats).toBeUndefined();
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ section: "reportStats" })
    );
  });

  it("returns a retryable server error when core statistics fail", async () => {
    mocks.getAdminOverviewStats.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ message: "database unavailable" });
  });
});
