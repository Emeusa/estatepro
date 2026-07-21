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

  it("keeps six common Android-sized JPEGs on the sequential browser processing path", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = Array.from({ length: 6 }, (_, index) => makeFile(`android-${index}.jpg`, Math.round(4.7 * 1024 * 1024)));

    await uploadListingImages(files, "token");

    expect(mocks.processListingImage).toHaveBeenCalledTimes(6);
    expect(fetch).toHaveBeenCalledTimes(12);
    expect(fetch).toHaveBeenCalledWith(
      "/api/uploads/listing-images/fallback",
      expect.objectContaining({ method: "POST" })
    );
    expect(mocks.publicUpload).not.toHaveBeenCalled();
    expect(mocks.originalUpload).not.toHaveBeenCalled();
  });

  it("uploads ten listing images without relying on upload route rate limits", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = Array.from({ length: 10 }, (_, index) => makeFile(`listing-${index}.jpg`, 500_000));

    const result = await uploadListingImages(files, "token");

    expect(result.imageUrls).toHaveLength(10);
    expect(result.imageVariants).toHaveLength(10);
    expect(mocks.processListingImage).toHaveBeenCalledTimes(10);
    expect(fetch).toHaveBeenCalledTimes(20);
    expect(mocks.publicUpload).not.toHaveBeenCalled();
    expect(mocks.originalUpload).not.toHaveBeenCalled();
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

  it("retries transient authenticated server upload failures before failing", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small.jpg", 500_000)];
    let uploadAttempts = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (!url.includes("/api/uploads/listing-images/fallback")) {
          return Response.json({});
        }

        uploadAttempts += 1;
        if (uploadAttempts === 1) {
          return Response.json({ message: "Server image upload failed." }, { status: 500 });
        }

        return Response.json({ url: `https://example.supabase.co/storage/v1/object/public/listing-images/agent-id/${uploadAttempts}.webp` });
      })
    );

    const result = await uploadListingImages(files, "token");

    expect(result.imageVariants).toHaveLength(1);
    expect(uploadAttempts).toBe(3);
    expect(mocks.publicUpload).not.toHaveBeenCalled();
  });

  it("uploads hard phone formats through the server conversion endpoint", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("ios-photo.heic", Math.round(3 * 1024 * 1024), "image/heic")];

    const result = await uploadListingImages(files, "token");

    expect(result.imageVariants).toHaveLength(1);
    expect(mocks.processListingImage).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/uploads/listing-images/convert",
      expect.objectContaining({ method: "POST" })
    );
    expect(mocks.originalUpload).not.toHaveBeenCalled();
  });

  it("rejects hard phone formats that are too large for the app API conversion path", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("ios-photo.heic", Math.round(5 * 1024 * 1024), "image/heic")];

    await expect(uploadListingImages(files, "token")).rejects.toThrow("Upload code: IMAGE_FORMAT_TOO_LARGE");
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/uploads/listing-images/convert",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("uses authenticated server fallback for browser-processable photos if mobile compression fails", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("android.jpg", Math.round(4.7 * 1024 * 1024))];

    mocks.processListingImage.mockRejectedValue(new Error("Canvas image decode failed"));

    const result = await uploadListingImages(files, "token");

    expect(result.imageVariants).toEqual([]);
    expect(result.imageUrls).toEqual(["https://example.supabase.co/storage/v1/object/public/listing-images/agent-id/server.webp"]);
    expect(mocks.originalUpload).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/uploads/listing-images/fallback",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("returns a useful message when server fallback succeeds without an image URL", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small.jpg", 500_000)];

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));

    await expect(uploadListingImages(files, "token")).rejects.toThrow(
      "Server upload completed without an image URL. Try again with fewer photos."
    );
  });

  it("returns a useful message when server conversion returns a generic failure", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("ios-photo.heic", Math.round(3 * 1024 * 1024), "image/heic")];

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 500 })));

    await expect(uploadListingImages(files, "token")).rejects.toThrow(
      "Upload code: IMAGE_COMPRESS_FAILED"
    );
  });
});
