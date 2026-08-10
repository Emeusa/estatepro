import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  getAdminListingRanking: vi.fn(),
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
  captureServerError: mocks.captureServerError
}));

vi.mock("@/lib/security/rate-limit", () => ({
  RATE_LIMITS: { admin: { name: "admin", limit: 60, windowSeconds: 60 } },
  rateLimit: mocks.rateLimit,
  withRateLimitHeaders: mocks.withRateLimitHeaders
}));

vi.mock("@/modules/listings/listing.service", () => ({
  getAdminListingRanking: mocks.getAdminListingRanking
}));

import { AuthError } from "../../src/lib/auth";
import { GET } from "../../src/app/api/admin/ranking/route";

function request(query = "") {
  return new NextRequest(`http://localhost:3000/api/admin/ranking${query}`);
}

describe("admin listing ranking route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireAdmin.mockResolvedValue({ uid: "admin-id", role: "admin" });
    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
    mocks.withRateLimitHeaders.mockImplementation((response: NextResponse) => response);
    mocks.getAdminListingRanking.mockResolvedValue({
      items: [],
      pagination: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
      snapshotAt: "2026-08-10T12:00:00.000Z"
    });
  });

  it("rejects non-admin requests before reading ranking data", async () => {
    mocks.requireAdmin.mockRejectedValue(new AuthError("Insufficient permissions", 403));

    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.getAdminListingRanking).not.toHaveBeenCalled();
  });

  it("passes validated public filter inputs to the shared ranking service", async () => {
    const response = await GET(request("?state=Lagos&listingCategory=for_rent&propertyType=apartment&page=2"));

    expect(response.status).toBe(200);
    expect(mocks.getAdminListingRanking).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "Lagos",
        listingCategory: "for_rent",
        propertyType: "apartment",
        page: "2",
        limit: 10
      })
    );
  });
});
