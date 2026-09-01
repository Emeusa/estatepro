import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerError: vi.fn(),
  logSecurityEvent: vi.fn(),
  requireAgent: vi.fn()
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

import { POST } from "../../src/app/api/uploads/listing-images/telemetry/route";

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/uploads/listing-images/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const validPayload = {
  stage: "browser-compress",
  code: "IMAGE_COMPRESS_FAILED",
  imageCount: 2,
  mimeTypes: ["image/jpeg"],
  sizeBuckets: ["4_to_8mb", "8_to_15mb"],
  failedIndex: 1,
  deviceClass: "android"
};

describe("listing image failure telemetry", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireAgent.mockResolvedValue({ uid: "agent-id" });
    mocks.logSecurityEvent.mockResolvedValue(undefined);
  });

  it("records only the bounded sanitized diagnostic payload", async () => {
    const response = await POST(request(validPayload));

    expect(response.status).toBe(204);
    expect(mocks.logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "listing_image_client_processing",
        result: "failed",
        userId: "agent-id",
        metadata: validPayload
      })
    );
  });

  it("rejects filenames and other unexpected client data", async () => {
    const response = await POST(request({ ...validPayload, filename: "private-photo.jpg" }));

    expect(response.status).toBe(400);
    expect(mocks.logSecurityEvent).not.toHaveBeenCalled();
  });
});
