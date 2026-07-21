import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  logSecurityEvent: vi.fn(),
  processListingImageOnServer: vi.fn(),
  rateLimit: vi.fn(),
  requireAgent: vi.fn(),
  withRateLimitHeaders: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) {
      super(message);
    }
  },
  requireAgent: mocks.requireAgent
}));

vi.mock("@/lib/security/logger", () => ({
  captureServerError: mocks.captureServerError,
  logSecurityEvent: mocks.logSecurityEvent
}));

vi.mock("@/lib/security/rate-limit", () => ({
  RATE_LIMITS: {
    imageUpload: { name: "imageUpload", limit: 20, windowSeconds: 60 }
  },
  rateLimit: mocks.rateLimit,
  withRateLimitHeaders: mocks.withRateLimitHeaders
}));

vi.mock("@/lib/server/listing-image-processor", () => ({
  processListingImageOnServer: mocks.processListingImageOnServer
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient
}));

import { AuthError } from "../../src/lib/auth";
import { POST } from "../../src/app/api/uploads/listing-images/convert/route";

function convertRequest(path = "agent-id/source-0-original.jpg") {
  return new NextRequest("http://localhost:3000/api/uploads/listing-images/convert", {
    method: "POST",
    body: JSON.stringify({
      originals: [{ path, order: 0 }]
    })
  });
}

function convertMultipartRequest(file = new File([Buffer.from("image")], "ios-photo.heic", { type: "image/heic" }), order = 0) {
  const form = new FormData();
  form.append("file", file);
  form.append("order", String(order));

  return new NextRequest("http://localhost:3000/api/uploads/listing-images/convert", {
    method: "POST",
    body: form
  });
}

function queryResult(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({ data, error })
  };
  return query;
}

function supabaseMock(options?: { agent?: unknown }) {
  const remove = vi.fn().mockResolvedValue({ error: null });
  const upload = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/listing-images/${path}` }
  }));
  const download = vi.fn().mockResolvedValue({
    data: new Blob([Buffer.from("image")], { type: "image/jpeg" }),
    error: null
  });
  let agentQueryCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === "agents") {
        agentQueryCount += 1;
        return queryResult(
          agentQueryCount === 1
            ? (options?.agent ?? { verification_status: "pending", is_blocked: false })
            : { business_name: "Test Homes" }
        );
      }

      if (table === "users") {
        return queryResult({ full_name: "Test Agent" });
      }

      if (table === "subscriptions") {
        return queryResult(null, { message: "not found" });
      }

      return queryResult(null);
    }),
    storage: {
      from: vi.fn((bucket: string) =>
        bucket === "listing-image-originals"
          ? { download, remove }
          : { upload, remove, getPublicUrl }
      )
    },
    mocks: { download, getPublicUrl, remove, upload }
  };
}

describe("listing image conversion route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());

    mocks.requireAgent.mockResolvedValue({ uid: "agent-id", role: "agent" });
    mocks.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
    mocks.withRateLimitHeaders.mockImplementation((response: NextResponse) => response);
    mocks.processListingImageOnServer.mockResolvedValue({
      hero: { buffer: Buffer.from("hero"), width: 1200, height: 800 },
      card: { buffer: Buffer.from("card"), width: 600, height: 400 },
      blurDataUrl: "data:image/webp;base64,abc"
    });
    mocks.createServerSupabaseClient.mockReturnValue(supabaseMock());
  });

  it("rejects logged-out conversion requests", async () => {
    mocks.requireAgent.mockRejectedValue(new AuthError("Authentication required", 401));

    const response = await POST(convertRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Authentication required");
    expect(mocks.processListingImageOnServer).not.toHaveBeenCalled();
  });

  it("rejects temporary originals outside the authenticated agent folder", async () => {
    const response = await POST(convertRequest("other-agent/source-0-original.jpg"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/does not belong/);
    expect(mocks.processListingImageOnServer).not.toHaveBeenCalled();
  });

  it("rejects blocked or rejected agents", async () => {
    const supabase = supabaseMock({ agent: { verification_status: "approved", is_blocked: true } });
    mocks.createServerSupabaseClient.mockReturnValue(supabase);

    const response = await POST(convertRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toMatch(/blocked/i);
    expect(mocks.processListingImageOnServer).not.toHaveBeenCalled();
  });

  it("converts pending unblocked agent originals to public WebP variants", async () => {
    const response = await POST(convertRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.imageVariants).toHaveLength(1);
    expect(body.imageVariants[0]).toEqual(
      expect.objectContaining({
        heroUrl: expect.stringContaining("-hero.webp"),
        cardUrl: expect.stringContaining("-card.webp"),
        width: 1200,
        height: 800,
        cardWidth: 600,
        cardHeight: 400
      })
    );
    expect(mocks.processListingImageOnServer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "image/jpeg",
      expect.objectContaining({ type: "platform" })
    );
  });

  it("converts direct multipart phone images for pending unblocked agents", async () => {
    const response = await POST(convertMultipartRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.imageUrls).toHaveLength(1);
    expect(body.imageVariants).toHaveLength(1);
    expect(mocks.processListingImageOnServer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "image/heic",
      expect.objectContaining({ type: "platform" })
    );
  });

  it("rejects direct multipart phone images above the app conversion limit", async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024)], "ios-photo.heic", { type: "image/heic" });

    const response = await POST(convertMultipartRequest(file));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("Upload code: IMAGE_FORMAT_TOO_LARGE");
    expect(mocks.processListingImageOnServer).not.toHaveBeenCalled();
  });
});
