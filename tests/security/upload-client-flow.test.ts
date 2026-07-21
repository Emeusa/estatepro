import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  getSession: vi.fn(),
  getPublicUrl: vi.fn(),
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
      from: () => ({
        getPublicUrl: mocks.getPublicUrl,
        remove: mocks.publicRemove,
        upload: mocks.publicUpload
      })
    }
  }
}));

function makeFile(name: string, size: number, type = "image/jpeg") {
  return new File([new Uint8Array(size)], name, { type, lastModified: 1 });
}

function makeSignatureFile(name: string, type: string, bytes: number[]) {
  return new File([new Uint8Array(bytes)], name, { type, lastModified: 1 });
}

function processedImage(index = 0, type = "image/webp") {
  const extension = type === "image/jpeg" ? "jpg" : "webp";
  return {
    hero: new File([new Uint8Array(256)], `hero-${index}.${extension}`, { type }),
    card: new File([new Uint8Array(128)], `card-${index}.${extension}`, { type }),
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
    mocks.apiRequest.mockImplementation(async (url: string) => {
      if (url === "/api/agents/me") {
        return { user: { fullName: "Test Agent" }, profile: { agent: { businessName: null }, subscription: null } };
      }

      return { ok: true };
    });
    mocks.getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/listing-images/${path}` }
    }));
    mocks.publicRemove.mockResolvedValue({ error: null });
    mocks.publicUpload.mockResolvedValue({ error: null });
    mocks.processListingImage.mockImplementation(async () => processedImage());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ url: "https://example.supabase.co/storage/v1/object/public/listing-images/agent-id/server.webp" })
      )
    );
  });

  it("keeps large phone JPEGs on the browser compression path", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("android-large.jpg", Math.round(8 * 1024 * 1024))];

    const result = await uploadListingImages(files, "token");

    expect(result.imageUrls).toHaveLength(1);
    expect(result.imageVariants).toHaveLength(1);
    expect(mocks.processListingImage).toHaveBeenCalledTimes(1);
    expect(mocks.publicUpload).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/uploads/listing-images/convert",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("normalizes valid JPEG content with unreliable mobile metadata before upload", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeSignatureFile("content", "application/octet-stream", [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])];

    const result = await uploadListingImages(files, "token");
    const processedFile = mocks.processListingImage.mock.calls[0]?.[0] as File;

    expect(result.imageVariants).toHaveLength(1);
    expect(processedFile.name).toBe("listing-image-1.jpg");
    expect(processedFile.type).toBe("image/jpeg");
    expect(mocks.publicUpload).toHaveBeenCalledTimes(2);
  });

  it("uploads fifteen listing images without server conversion", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = Array.from({ length: 15 }, (_, index) => makeFile(`listing-${index}.jpg`, 500_000));

    const result = await uploadListingImages(files, "token");

    expect(result.imageUrls).toHaveLength(15);
    expect(result.imageVariants).toHaveLength(15);
    expect(mocks.processListingImage).toHaveBeenCalledTimes(15);
    expect(mocks.publicUpload).toHaveBeenCalledTimes(30);
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/uploads/listing-images/convert",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("processes browser-optimized images sequentially", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small-1.jpg", 500_000), makeFile("small-2.jpg", 500_000), makeFile("small-3.jpg", 500_000)];
    let active = 0;
    let maxActive = 0;

    mocks.processListingImage.mockImplementation(async () => {
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

  it("falls back to authenticated server upload only for compressed final images", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small.jpg", 500_000)];
    let uploadAttempts = 0;

    mocks.publicUpload.mockResolvedValue({ error: new Error("direct storage failed") });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toBe("/api/uploads/listing-images/fallback");
        uploadAttempts += 1;
        if (uploadAttempts % 2 === 1) {
          return Response.json({ message: "Server image upload failed." }, { status: 500 });
        }

        return Response.json({ url: `https://example.supabase.co/storage/v1/object/public/listing-images/agent-id/${uploadAttempts}.webp` });
      })
    );

    const result = await uploadListingImages(files, "token");

    expect(result.imageVariants).toHaveLength(1);
    expect(uploadAttempts).toBe(4);
    expect(mocks.publicUpload).toHaveBeenCalledTimes(2);
  });

  it("keeps JPEG fallback output as valid final variants", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small.jpg", 500_000)];

    mocks.processListingImage.mockResolvedValue(processedImage(0, "image/jpeg"));

    const result = await uploadListingImages(files, "token");

    expect(result.imageVariants[0]?.heroUrl).toContain("-hero.jpg");
    expect(result.imageVariants[0]?.cardUrl).toContain("-card.jpg");
  });

  it("uses business name watermark for Pro and Agency Plus agents", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small.jpg", 500_000)];

    mocks.apiRequest.mockImplementation(async (url: string) => {
      if (url === "/api/agents/me") {
        return {
          user: { fullName: "Julie Stockton" },
          profile: { agent: { businessName: "PCL HOMES" }, subscription: { planSlug: "agency_plus", status: "active", isActive: true } }
        };
      }

      return { ok: true };
    });

    await uploadListingImages(files, "token");

    expect(mocks.processListingImage).toHaveBeenCalledWith(files[0], { type: "agent", text: "PCL HOMES" });
  });

  it("rejects HEIC and AVIF with clear iPhone guidance instead of server conversion", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("ios-photo.heic", Math.round(3 * 1024 * 1024), "image/heic")];

    await expect(uploadListingImages(files, "token")).rejects.toThrow("choose Options and send as JPG/Most Compatible");
    expect(mocks.processListingImage).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/uploads/listing-images/convert",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns a useful message when browser compression fails", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("android.jpg", Math.round(4 * 1024 * 1024))];

    mocks.processListingImage.mockRejectedValue(new Error("Canvas image decode failed"));

    await expect(uploadListingImages(files, "token")).rejects.toThrow("Upload code: IMAGE_COMPRESS_FAILED");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a useful message when server fallback succeeds without an image URL", async () => {
    const { uploadListingImages } = await import("../../src/lib/uploads");
    const files = [makeFile("small.jpg", 500_000)];

    mocks.publicUpload.mockResolvedValue({ error: new Error("direct storage failed") });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));

    await expect(uploadListingImages(files, "token")).rejects.toThrow(
      "Server upload completed without an image URL. Try again with fewer photos."
    );
  });
});
