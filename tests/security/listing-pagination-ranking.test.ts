import { describe, expect, it } from "vitest";

import {
  getListingPromotionBadge,
  getListingRankingBreakdown,
  rankListingsForFeed,
  rankListingsForFeedWithDiagnostics
} from "../../src/lib/listing-visibility";
import type { ListingRecord } from "../../src/lib/types";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const FUTURE = "2026-08-17T12:00:00.000Z";

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function listing(id: string, agentId: string, overrides: Partial<ListingRecord> = {}): ListingRecord {
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
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides
  };
}

function highQualityListing(id: string, agentId: string, overrides: Partial<ListingRecord> = {}) {
  return listing(id, agentId, {
    description: "A detailed property description that clearly explains the rooms, condition, location, utilities, access, and other information a serious property seeker needs before arranging an inspection.",
    imageUrls: Array.from({ length: 10 }, (_, index) =>
      `https://example.supabase.co/storage/v1/object/public/listing-images/${agentId}/${id}-${index}.webp`
    ),
    imageVariants: [
      {
        heroUrl: `https://example.supabase.co/storage/v1/object/public/listing-images/${agentId}/${id}-hero.webp`,
        cardUrl: `https://example.supabase.co/storage/v1/object/public/listing-images/${agentId}/${id}-card.webp`,
        blurDataUrl: null,
        width: 1200,
        height: 900,
        cardWidth: 600,
        cardHeight: 450,
        order: 0
      }
    ],
    propertySize: 120,
    propertySizeUnit: "sqm",
    amenities: ["Balcony"],
    titleDocumentType: "certificate_of_occupancy",
    photosVerifiedAt: NOW.toISOString(),
    ...overrides
  });
}

describe("ranking-safe listing pagination", () => {
  it("places Premium listings at global positions 1, 5, and 9 before page slicing", () => {
    const candidates = Array.from({ length: 24 }, (_, index) => listing(`organic-${index}`, `agent-${index % 8}`));
    candidates.push(
      listing("premium-a", "premium-agent-a", { sponsoredUntil: FUTURE }),
      listing("premium-b", "premium-agent-b", { sponsoredUntil: FUTURE }),
      listing("premium-c", "premium-agent-c", { sponsoredUntil: FUTURE })
    );

    const ranked = rankListingsForFeed(candidates, candidates.length, NOW);
    expect([ranked[0].id, ranked[4].id, ranked[8].id].every((id) => id.startsWith("premium-"))).toBe(true);

    const firstPage = ranked.slice(0, 10);
    const secondPage = ranked.slice(10, 20);
    expect(firstPage).toHaveLength(10);
    expect(secondPage).toHaveLength(10);
    expect(new Set([...firstPage, ...secondPage].map((item) => item.id)).size).toBe(20);
  });

  it("keeps additional active Premium listings in paid-score order instead of appending them", () => {
    const premiums = Array.from({ length: 6 }, (_, index) =>
      listing(`premium-${index}`, `premium-agent-${index}`, { sponsoredUntil: FUTURE })
    );
    const regular = Array.from({ length: 20 }, (_, index) => listing(`regular-${index}`, `regular-agent-${index}`));
    const ranked = rankListingsForFeed([...regular, ...premiums], 26, NOW);

    expect([ranked[0], ranked[4], ranked[8]].every((item) => item.sponsoredUntil === FUTURE)).toBe(true);
    expect(ranked.slice(0, 9).filter((item) => item.sponsoredUntil === FUTURE)).toHaveLength(6);
  });

  it("gives Sponsored a strong advantage without guaranteeing it above a substantially better listing", () => {
    const sponsored = listing("sponsored", "sponsored-agent", {
      createdAt: daysAgo(10),
      featuredUntil: FUTURE
    });
    const comparableRegular = listing("comparable", "regular-agent");
    const excellentRegular = highQualityListing("excellent", "excellent-agent");

    const comparableOrder = rankListingsForFeed([comparableRegular, sponsored], 2, NOW);
    expect(comparableOrder[0].id).toBe("sponsored");

    const qualityOrder = rankListingsForFeed([excellentRegular, sponsored], 2, NOW);
    expect(qualityOrder[0].id).toBe("excellent");
  });

  it("does not give Sponsored listings a fixed Premium slot", () => {
    const sponsored = listing("sponsored", "agent-sponsored", { featuredUntil: FUTURE });
    const ranked = rankListingsForFeedWithDiagnostics([
      sponsored,
      listing("premium-a", "premium-agent-a", { sponsoredUntil: FUTURE }),
      listing("premium-b", "premium-agent-b", { sponsoredUntil: FUTURE }),
      listing("premium-c", "premium-agent-c", { sponsoredUntil: FUTURE }),
      ...Array.from({ length: 12 }, (_, index) => listing(`organic-${index}`, `agent-${index}`))
    ], 16, NOW);

    expect(ranked.filter(({ breakdown }) => breakdown.fixedPremiumSlot).map(({ position }) => position)).toEqual([1, 5, 9]);
    expect(ranked.find(({ listing: item }) => item.id === sponsored.id)?.breakdown.fixedPremiumSlot).toBe(false);
  });

  it("uses freshness to rank a comparable new listing above an old listing", () => {
    const fresh = listing("fresh", "fresh-agent");
    const stale = listing("stale", "stale-agent", { createdAt: daysAgo(20) });
    const ranked = rankListingsForFeed([stale, fresh], 2, NOW);
    expect(ranked.map((item) => item.id)).toEqual(["fresh", "stale"]);
  });

  it("applies Boost and plan refresh through freshness with an explicit source", () => {
    const oldDate = daysAgo(20);
    const boosted = listing("boosted", "agent-boosted", { createdAt: oldDate, boostedAt: NOW.toISOString() });
    const refreshed = listing("refreshed", "agent-refreshed", {
      createdAt: oldDate,
      lastRefreshedAt: daysAgo(1)
    });
    const stale = listing("stale", "agent-stale", { createdAt: oldDate });
    const ranked = rankListingsForFeedWithDiagnostics([stale, refreshed, boosted], 3, NOW);

    expect(ranked[0].listing.id).toBe("boosted");
    expect(ranked[0].breakdown.freshnessSource).toBe("boost");
    expect(ranked.find(({ listing: item }) => item.id === "refreshed")?.breakdown.freshnessSource).toBe("plan_refresh");
  });

  it("ignores expired timestamps and stale legacy promotion types", () => {
    const expired = listing("expired", "agent-expired", {
      promotionType: "premium",
      sponsoredUntil: daysAgo(1),
      featuredUntil: daysAgo(1)
    });
    const breakdown = getListingRankingBreakdown(expired, NOW);

    expect(breakdown.promotionTier).toBe("regular");
    expect(breakdown.promotionBonus).toBe(0);
    expect(getListingPromotionBadge(expired, NOW)).toBeNull();
  });

  it("limits an agent to three listings on each page and no more than two consecutively", () => {
    const dominant = Array.from({ length: 10 }, (_, index) => highQualityListing(`dominant-${index}`, "same-agent"));
    const alternatives = Array.from({ length: 15 }, (_, index) => listing(`alternative-${index}`, `agent-${index}`));
    const ranked = rankListingsForFeed([...dominant, ...alternatives], 25, NOW);
    const firstPage = ranked.slice(0, 10);
    const secondPage = ranked.slice(10, 20);

    expect(firstPage.filter((item) => item.agentId === "same-agent")).toHaveLength(3);
    expect(secondPage.filter((item) => item.agentId === "same-agent")).toHaveLength(3);
    for (let index = 2; index < firstPage.length + secondPage.length; index += 1) {
      expect(new Set(ranked.slice(index - 2, index + 1).map((item) => item.agentId)).size).toBeGreaterThan(1);
    }
  });

  it("relaxes diversity deterministically when one agent is the only available supply", () => {
    const candidates = Array.from({ length: 5 }, (_, index) => listing(`only-${index}`, "only-agent"));
    const ranked = rankListingsForFeedWithDiagnostics(candidates, 5, NOW);

    expect(ranked).toHaveLength(5);
    expect(ranked.some(({ breakdown }) => breakdown.diversityAdjustments.includes("relaxed"))).toBe(true);
  });

  it("excludes inactive and unavailable listings before pagination", () => {
    const ranked = rankListingsForFeed([
      listing("active", "agent-a"),
      listing("inactive", "agent-b", { status: "inactive" }),
      listing("rented", "agent-c", { availability: "rented" })
    ], 3, NOW);
    expect(ranked.map((item) => item.id)).toEqual(["active"]);
  });
});
