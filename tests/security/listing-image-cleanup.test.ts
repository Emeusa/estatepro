import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerSupabaseClient: vi.fn(), remove: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient
}));

import {
  reconcileListingImageOrphans,
  selectEligibleListingImageOrphans
} from "../../src/modules/listings/listing-image-cleanup.service";

const agentId = "67bf6f5a-4650-4369-8e5d-60c8a588ff28";
const referencedPath = `${agentId}/referenced.webp`;
const orphanPath = `${agentId}/old-orphan.webp`;
const recentPath = `${agentId}/recent-orphan.webp`;
const projectUrl = "https://example.supabase.co";

function publicUrl(path: string) {
  return `${projectUrl}/storage/v1/object/public/listing-images/${path}`;
}

function createSupabaseMock() {
  const listingQuery = {
    select: vi.fn(),
    range: vi.fn().mockResolvedValue({
      data: [{ image_urls: [publicUrl(referencedPath)], image_variants: [] }],
      error: null
    })
  };
  listingQuery.select.mockReturnValue(listingQuery);
  const list = vi.fn(async (prefix: string) => {
    if (!prefix) {
      return { data: [{ name: agentId, id: null }], error: null };
    }

    return {
      data: [
        { name: "referenced.webp", id: "1", created_at: "2026-01-01T00:00:00.000Z" },
        { name: "old-orphan.webp", id: "2", created_at: "2026-01-01T00:00:00.000Z" },
        { name: "recent-orphan.webp", id: "3", created_at: new Date().toISOString() }
      ],
      error: null
    };
  });
  mocks.remove.mockResolvedValue({ error: null });
  return {
    from: vi.fn(() => listingQuery),
    storage: { from: vi.fn(() => ({ list, remove: mocks.remove })) }
  };
}

describe("listing image orphan cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = projectUrl;
    mocks.createServerSupabaseClient.mockReturnValue(createSupabaseMock());
  });

  it("selects only old, unreferenced, safely-scoped image objects", () => {
    const result = selectEligibleListingImageOrphans({
      objects: [
        { path: referencedPath, createdAt: "2026-01-01T00:00:00.000Z" },
        { path: orphanPath, createdAt: "2026-01-01T00:00:00.000Z" },
        { path: recentPath, createdAt: "2026-08-31T12:00:00.000Z" },
        { path: "unsafe-root-file.webp", createdAt: "2026-01-01T00:00:00.000Z" }
      ],
      referencedPaths: new Set([referencedPath]),
      now: new Date("2026-09-01T00:00:00.000Z")
    });

    expect(result.eligible.map((object) => object.path)).toEqual([orphanPath]);
    expect(result.protectedRecentObjects).toBe(1);
  });

  it("defaults to a dry run and never deletes candidates", async () => {
    const result = await reconcileListingImageOrphans();

    expect(result).toMatchObject({ dryRun: true, scannedObjects: 3, referencedObjects: 1, eligibleOrphans: 1 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes only eligible candidates when explicitly applied", async () => {
    const result = await reconcileListingImageOrphans({ dryRun: false, maxDeletes: 250 });

    expect(mocks.remove).toHaveBeenCalledWith([orphanPath]);
    expect(result.deletedObjects).toBe(1);
    expect(result.failedObjects).toBe(0);
  });
});
