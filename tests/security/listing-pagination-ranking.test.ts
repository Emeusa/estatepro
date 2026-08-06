import { describe, expect, it } from "vitest";

import { rankListingsForFeed } from "../../src/lib/listing-visibility";
import type { ListingRecord } from "../../src/lib/types";

function listing(id: string, agentId: string, overrides: Partial<ListingRecord> = {}): ListingRecord {
  const now = new Date().toISOString();
  return {
    id,
    slug: id,
    agentId,
    title: `Complete property listing ${id}`,
    description: "A complete and useful property description with enough information for prospective tenants and buyers.",
    price: 1_000_000,
    propertyType: "apartment",
    listingCategory: "for_rent",
    availability: "available",
    status: "active",
    imageUrls: [`https://example.supabase.co/storage/v1/object/public/listing-images/${agentId}/${id}.webp`],
    imageVariants: [],
    promotionType: "standard",
    boostedAt: null,
    lastRefreshedAt: null,
    expiresAt: null,
    featuredUntil: null,
    sponsoredUntil: null,
    photosVerifiedAt: null,
    contactPhone: "08000000000",
    contactWhatsapp: "08000000000",
    location: { state: "Lagos", city: "Ikeja", area: "Allen", slug: "lagos-ikeja-allen" },
    bedrooms: 2,
    bathrooms: 2,
    toilets: 2,
    parkingSpaces: 1,
    propertySize: null,
    propertySizeUnit: null,
    yearBuilt: null,
    floorLevel: null,
    totalFloors: null,
    furnishingStatus: null,
    servicingStatus: null,
    propertyCondition: null,
    amenities: [],
    utilities: [],
    safetyFeatures: [],
    nearbyLandmarks: [],
    extraFeatures: [],
    landSize: null,
    landSizeUnit: null,
    titleDocumentType: null,
    zoningType: null,
    roadAccess: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("ranking-safe listing pagination", () => {
  it("places Premium listings at global positions 1, 5, and 9 before page slicing", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const candidates = Array.from({ length: 24 }, (_, index) => listing(`organic-${index}`, `agent-${index % 8}`));
    candidates.push(
      listing("premium-a", "premium-agent-a", { sponsoredUntil: future }),
      listing("premium-b", "premium-agent-b", { sponsoredUntil: future }),
      listing("premium-c", "premium-agent-c", { sponsoredUntil: future })
    );

    const ranked = rankListingsForFeed(candidates);
    expect([ranked[0].id, ranked[4].id, ranked[8].id].every((id) => id.startsWith("premium-"))).toBe(true);

    const firstPage = ranked.slice(0, 10);
    const secondPage = ranked.slice(10, 20);
    expect(firstPage).toHaveLength(10);
    expect(secondPage).toHaveLength(10);
    expect(new Set([...firstPage, ...secondPage].map((item) => item.id)).size).toBe(20);
  });

  it("does not give Sponsored listings a fixed Premium slot", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const sponsored = listing("sponsored", "agent-sponsored", { featuredUntil: future });
    const ranked = rankListingsForFeed([
      sponsored,
      listing("premium-a", "premium-agent-a", { sponsoredUntil: future }),
      listing("premium-b", "premium-agent-b", { sponsoredUntil: future }),
      listing("premium-c", "premium-agent-c", { sponsoredUntil: future }),
      ...Array.from({ length: 12 }, (_, index) => listing(`organic-${index}`, `agent-${index}`))
    ]);

    expect([ranked[0], ranked[4], ranked[8]].every((item) => Boolean(item.sponsoredUntil))).toBe(true);
    expect([ranked[0], ranked[4], ranked[8]].some((item) => item.id === sponsored.id)).toBe(false);
    expect(ranked.some((item) => item.id === sponsored.id)).toBe(true);
  });

  it("applies Boost through freshness without creating a fixed slot", () => {
    const oldDate = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const boosted = listing("boosted", "agent-boosted", { createdAt: oldDate, boostedAt: new Date().toISOString() });
    const stale = listing("stale", "agent-stale", { createdAt: oldDate });
    const ranked = rankListingsForFeed([stale, boosted]);
    expect(ranked[0].id).toBe("boosted");
    expect(ranked[0].sponsoredUntil).toBeNull();
  });

  it("applies agent diversity before filling remaining organic positions", () => {
    const dominant = Array.from({ length: 5 }, (_, index) =>
      listing(`dominant-${index}`, "same-agent", { photosVerifiedAt: new Date().toISOString() })
    );
    const alternatives = Array.from({ length: 5 }, (_, index) => listing(`alternative-${index}`, `agent-${index}`));
    const ranked = rankListingsForFeed([...dominant, ...alternatives]);
    expect(ranked.slice(0, 7).filter((item) => item.agentId === "same-agent")).toHaveLength(2);
  });

  it("excludes inactive and unavailable listings before pagination", () => {
    const ranked = rankListingsForFeed([
      listing("active", "agent-a"),
      listing("inactive", "agent-b", { status: "inactive" }),
      listing("rented", "agent-c", { availability: "rented" })
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["active"]);
  });
});
