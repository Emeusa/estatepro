import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  getSession: vi.fn(),
  getPublicUrl: vi.fn(),
  originalRemove: vi.fn(),
  originalUpload: vi.fn(),
  processListingImage: vi.fn(),
  publicRemove: vi.fn(),
  publicUpload: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  apiRequest: mocks.apiRequest
}));

vi.mock("@/lib/image", () => ({
  processListingImage: mocks.processListingImage
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession
    },
    storage: {
      from: (bucket: string) => {
        if (bucket === "listing-image-originals") {
          return {
            remove: mocks.originalRemove,
            upload: mocks.originalUpload
          };
        }

        return {
          getPublicUrl: mocks.getPublicUrl,
          remove: mocks.publicRemove,
          upload: mocks.publicUpload
        };
      }
    }
  }
}));

function makeFile(name: string, size: number, type = "image/jpeg") {
  return new File([new Uint8Array(size)], name, { type, lastModified: 1 });
}

function processedImage(index = 0) {
  return {
    hero: new File([new Uint8Array(256)], `hero-${index}.webp`, { type: "image/webp" }),
    card: new File([new Uint8Array(128)], `card-${index}.webp`, { type: "image/webp" }),
    blurDataUrl: "data:image/webp;base64,abc",
    width: 1200,
    height: 800,
    cardWidth: 600,
    cardHeight: 400
  };
}

describe("client listing image upload flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.values(mocks).forEach((mock) => mock.mockReset());

    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "agent-id" } } } });
    mocks.apiRequest.mockResolvedValue({ ok: true, user: { fullName: "Test Agent" }, profile: { subscription: null } });
    mocks.getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/listing-images/${path}` }
    }));
    mocks.originalRemove.mockResolvedValue({ error: null });
    mocks.originalUpload.mockResolvedValue({ error: null });
    mocks.publicRemove.mockResolvedValue({ error: null });
    mocks.publicUpload.mockResolvedValue({ error: null });
    mocks.processListingImage.mockImplementation(async () => processedImage());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/uploads/listing-images/convert")) {
          return Response.json({
            imageUrls: ["https://example.supabase.co/storage/v1/object/public/listing-images/agent-id/hero.webp"],
            imageVariants: [
              {
                heroUrl: "https://example.supabase.co/storage/v1/object/public/listing-images/agent-id/hero.webp",
                cardUrl: "https://example.supabase.co/storage/v1/object/public/listing-images/agent-id/card.webp",
                blurDataUrl: "data:image/webp;base64,abc",
                width: 1200,
                height: 800,
                cardWidth: 600,
                cardHeight: 400,
                order: 0
              }
            ]
          });
        }

        return Response.json({ url: "https://example.supabase.co/storage/v1/object/public/listing-images/agent-id/server.webp" });
      })
    );
  });

  it("routes six Android-sized JPEGs through server conversion instead of browser canvas processing", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = Array.from({ length: 6 }, (_, index) => makeFile(`android-${index}.jpg`, Math.round(4.7 * 1024 * 1024)));

    await uploadListingImages(files, "token");

    expect(mocks.processListingImage).not.toHaveBeenCalled();
    expect(mocks.originalUpload).toHaveBeenCalledTimes(6);
    expect(fetch).toHaveBeenCalledWith(
      "/api/uploads/listing-images/convert",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("processes browser-optimized images sequentially", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small-1.jpg", 500_000), makeFile("small-2.jpg", 500_000), makeFile("small-3.jpg", 500_000)];
    let active = 0;
    let maxActive = 0;

    mocks.processListingImage.mockImplementation(async (_file, _watermark) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return processedImage();
    });

    await uploadListingImages(files, "token");

    expect(mocks.processListingImage).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(1);
  });

  it("retries transient direct storage upload failures before failing", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small.jpg", 500_000)];
    let uploadAttempts = 0;

    mocks.publicUpload.mockImplementation(async () => {
      uploadAttempts += 1;
      if (uploadAttempts === 1) {
        return { error: { message: "Network timeout while uploading to storage" } };
      }

      return { error: null };
    });

    const result = await uploadListingImages(files, "token");

    expect(result.imageVariants).toHaveLength(1);
    expect(uploadAttempts).toBe(3);
  });

  it("returns a specific setup message when temporary original upload fails", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("large.jpg", Math.round(4.7 * 1024 * 1024))];

    mocks.originalUpload.mockResolvedValue({ error: { message: "Bucket not found" } });

    await expect(uploadListingImages(files, "token")).rejects.toThrow(
      "Temporary image storage is not configured. Run the latest Supabase storage setup."
    );
  });

  it("returns a useful message when server fallback succeeds without an image URL", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small.jpg", 500_000)];

    mocks.publicUpload.mockResolvedValue({ error: { message: "Network timeout while uploading to storage" } });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));

    await expect(uploadListingImages(files, "token")).rejects.toThrow(
      "Server upload completed without an image URL. Try again with fewer photos."
    );
  });

  it("returns a useful message when server conversion returns a generic failure", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("large.jpg", Math.round(4.7 * 1024 * 1024))];

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 500 })));

    await expect(uploadListingImages(files, "token")).rejects.toThrow(
      "We could not compress one of these phone photos. Try uploading fewer photos or export the photo as JPG."
    );
  });
});
