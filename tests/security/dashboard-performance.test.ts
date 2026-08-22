import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getAgentProfile: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient
}));

vi.mock("@/modules/agents/agent.repository", () => ({
  getAgentProfile: mocks.getAgentProfile
}));

import { getAgentAnalytics } from "../../src/modules/analytics/analytics.service";
import {
  getAgentListingSummary,
  listAgentListings
} from "../../src/modules/listings/listing.repository";

function activeSubscription(planSlug = "starter_agent") {
  return {
    agentId: "agent-id",
    planSlug,
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
}

describe("dashboard data performance helpers", () => {
  beforeEach(() => {
    mocks.createServerSupabaseClient.mockReset();
    mocks.getAgentProfile.mockReset();
  });

  it("returns no agent listings without opening Supabase when limit is zero", async () => {
    await expect(listAgentListings("agent-id", 0)).resolves.toEqual([]);
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("respects requested agent listing limit", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn()
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [], error: null });
    const from = vi.fn(() => query);
    mocks.createServerSupabaseClient.mockReturnValue({ from });

    await expect(listAgentListings("agent-id", 3)).resolves.toEqual([]);

    expect(from).toHaveBeenCalledWith("listings");
    expect(query.limit).toHaveBeenCalledWith(3);
  });

  it("summarizes the complete inventory without loading full listing records", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn()
    };
    query.select.mockReturnValue(query);
    query.eq.mockResolvedValue({
      data: [
        { status: "active", availability: "available" },
        { status: "active", availability: "available" },
        { status: "pending", availability: "available" },
        { status: "inactive", availability: "rented" }
      ],
      error: null
    });
    const from = vi.fn(() => query);
    mocks.createServerSupabaseClient.mockReturnValue({ from });

    await expect(getAgentListingSummary("agent-id")).resolves.toEqual({
      total: 4,
      active: 2,
      pending: 1,
      unavailable: 1
    });
    expect(query.select).toHaveBeenCalledWith("status, availability");
    expect(query.eq).toHaveBeenCalledWith("agent_id", "agent-id");
  });

  it("does not re-fetch agent profile when analytics receives subscription context", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn()
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gte.mockResolvedValue({ data: [], error: null });
    mocks.createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => query) });

    const analytics = await getAgentAnalytics("agent-id", "30d", activeSubscription());

    expect(analytics.analyticsLevel).toBe("basic");
    expect(mocks.getAgentProfile).not.toHaveBeenCalled();
  });

  it("keeps listing edit actions tied to a scroll-to-editor helper", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/agents/listing-manager.tsx"), "utf8");

    expect(source).toContain("function selectListingForEdit(listing: ListingRecord)");
    expect(source).toContain("window.requestAnimationFrame");
    expect(source).toContain('document.getElementById("listing-editor")?.scrollIntoView');
    expect(source).toContain("setMessage(`Editing: ${listing.title}`);");
    expect(source).toContain('className="scroll-mt-24"');
  });

  it("renders dashboard totals from the authoritative summary and refreshes it after changes", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/agents/dashboard/page.tsx"), "utf8");

    expect(source).toContain("includeListingSummary=true");
    expect(source).toContain("const stats = data?.listingSummary");
    expect(source).toContain("const dashboardToken = data.token");
    expect(source).toContain("void refreshDashboardSummary(dashboardToken)");
    expect(source).not.toContain("total: listings.length");
  });
});
