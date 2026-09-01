import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  refreshSession: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    status?: number;
  },
  apiRequest: mocks.apiRequest
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { auth: { refreshSession: mocks.refreshSession } }
}));

import { ApiRequestError } from "../../src/lib/api";
import { loadAdminDashboard } from "../../src/lib/admin-dashboard-client";

const overview = {
  stats: { totalAgents: 1, approvedAgents: 1, activeListings: 2, unapprovedAgents: 0 },
  degradedSections: []
};

describe("admin dashboard session retry", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("refreshes the session once after a 401 and retries with the fresh token", async () => {
    let firstOverview = true;
    mocks.apiRequest.mockImplementation(async (url: string, options: RequestInit) => {
      if (url === "/api/admin/overview" && firstOverview) {
        firstOverview = false;
        const error = new ApiRequestError("expired");
        error.status = 401;
        throw error;
      }

      if (url === "/api/admin/overview") return overview;
      return { user: { id: "admin-id", role: "admin" } };
    });
    mocks.refreshSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
      error: null
    });

    const result = await loadAdminDashboard("stale-token");

    expect(result.accessToken).toBe("fresh-token");
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/api/admin/overview",
      expect.objectContaining({ headers: { Authorization: "Bearer fresh-token" } })
    );
  });

  it("does not refresh or retry forbidden admin access", async () => {
    const error = new ApiRequestError("forbidden");
    error.status = 403;
    mocks.apiRequest.mockRejectedValue(error);

    await expect(loadAdminDashboard("valid-token")).rejects.toThrow("forbidden");
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });
});
