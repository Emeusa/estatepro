import { getListingImageCount } from "@/lib/listing-images";
import { ListingRecord } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const PREMIUM_SLOTS = [0, 4, 8];
const RANKING_PAGE_SIZE = 10;
const MAX_LISTINGS_PER_AGENT_PER_PAGE = 3;
const MAX_CONSECUTIVE_LISTINGS_PER_AGENT = 2;

export type ListingPromotionTier = "premium" | "sponsored" | "regular";
export type ListingFreshnessSource = "boost" | "plan_refresh" | "created";
export type ListingDiversityAdjustment = "page_limit" | "consecutive_limit" | "relaxed";

export type ListingRankingBreakdown = {
  qualityScore: number;
  freshnessScore: number;
  freshnessSource: ListingFreshnessSource;
  freshnessAt: string;
  promotionTier: ListingPromotionTier;
  promotionBonus: number;
  baseScore: number;
  finalScore: number;
  fixedPremiumSlot: boolean;
  diversityAdjustments: ListingDiversityAdjustment[];
};

export type RankedListing = {
  listing: ListingRecord;
  position: number;
  breakdown: ListingRankingBreakdown;
};

type RankingCandidate = {
  listing: ListingRecord;
  breakdown: ListingRankingBreakdown;
};

function timestamp(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isFuture(value: string | null | undefined, nowMs: number) {
  const valueTimestamp = timestamp(value);
  return valueTimestamp !== null && valueTimestamp > nowMs;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function qualityScore(listing: ListingRecord) {
  let score = 20;
  const imageCount = getListingImageCount(listing);

  score += Math.min(imageCount, 10) * 4;
  if (listing.imageVariants.length) score += 10;
  if (listing.title.length >= 18) score += 6;
  if (listing.description.length >= 120) score += 8;
  if (listing.location.area && listing.location.city && listing.location.state) score += 8;
  if (listing.bedrooms || listing.bathrooms) score += 7;
  if (listing.propertySize || listing.landSize) score += 5;
  if (listing.amenities.length || listing.utilities.length || listing.safetyFeatures.length) score += 8;
  if (listing.titleDocumentType) score += 4;
  if (listing.photosVerifiedAt) score += 8;

  if (imageCount === 0) score -= 50;
  if (listing.description.length < 50) score -= 15;
  if (/(whatsapp|call|070|080|081|090|091){2,}/i.test(listing.description)) score -= 10;

  return clampScore(score);
}

function freshnessActivity(listing: ListingRecord) {
  const activities: Array<{ source: ListingFreshnessSource; value: string | null | undefined }> = [
    { source: "boost", value: listing.boostedAt },
    { source: "plan_refresh", value: listing.lastRefreshedAt },
    { source: "created", value: listing.createdAt }
  ];
  let selected = activities[activities.length - 1];
  let selectedTimestamp = timestamp(selected.value) ?? 0;

  for (const activity of activities) {
    const activityTimestamp = timestamp(activity.value);
    if (activityTimestamp !== null && activityTimestamp > selectedTimestamp) {
      selected = activity;
      selectedTimestamp = activityTimestamp;
    }
  }

  return {
    source: selected.source,
    at: selected.value ?? listing.createdAt,
    timestamp: selectedTimestamp
  };
}

function freshnessScore(listing: ListingRecord, nowMs: number) {
  const activity = freshnessActivity(listing);
  const ageInDays = Math.max(0, (nowMs - activity.timestamp) / DAY_MS);
  return {
    activity,
    score: clampScore(100 - ageInDays * 3.5)
  };
}

function promotionTier(
  listing: Pick<ListingRecord, "sponsoredUntil" | "featuredUntil">,
  nowMs: number
): ListingPromotionTier {
  if (isFuture(listing.sponsoredUntil, nowMs)) return "premium";
  if (isFuture(listing.featuredUntil, nowMs)) return "sponsored";
  return "regular";
}

function promotionBonus(tier: ListingPromotionTier) {
  if (tier === "premium") return 30;
  if (tier === "sponsored") return 20;
  return 0;
}

export function getListingPromotionBadge(
  listing: Pick<ListingRecord, "sponsoredUntil" | "featuredUntil" | "promotionType">,
  now = new Date()
) {
  const tier = promotionTier(listing, now.getTime());
  if (tier === "premium") return "Premium";
  if (tier === "sponsored") return "Sponsored";
  return null;
}

export function isListingFeedEligible(listing: ListingRecord, now = new Date()) {
  if (listing.status !== "active" || listing.availability !== "available") return false;
  if (getListingImageCount(listing) < 1) return false;
  if (listing.expiresAt && !isFuture(listing.expiresAt, now.getTime())) return false;
  return true;
}

export function getListingRankingBreakdown(listing: ListingRecord, now = new Date()): ListingRankingBreakdown {
  const nowMs = now.getTime();
  const quality = qualityScore(listing);
  const freshness = freshnessScore(listing, nowMs);
  const tier = promotionTier(listing, nowMs);
  const bonus = promotionBonus(tier);
  const baseScore = quality * 0.6 + freshness.score * 0.4;

  return {
    qualityScore: quality,
    freshnessScore: freshness.score,
    freshnessSource: freshness.activity.source,
    freshnessAt: freshness.activity.at,
    promotionTier: tier,
    promotionBonus: bonus,
    baseScore,
    finalScore: baseScore + bonus,
    fixedPremiumSlot: false,
    diversityAdjustments: []
  };
}

export function getListingVisibilityScore(listing: ListingRecord, now = new Date()) {
  return getListingRankingBreakdown(listing, now).finalScore;
}

function compareCandidates(first: RankingCandidate, second: RankingCandidate) {
  const scoreDifference = second.breakdown.finalScore - first.breakdown.finalScore;
  if (scoreDifference !== 0) return scoreDifference;

  const activityDifference =
    (timestamp(second.breakdown.freshnessAt) ?? 0) - (timestamp(first.breakdown.freshnessAt) ?? 0);
  if (activityDifference !== 0) return activityDifference;

  const createdDifference =
    (timestamp(second.listing.createdAt) ?? 0) - (timestamp(first.listing.createdAt) ?? 0);
  if (createdDifference !== 0) return createdDifference;
  return first.listing.id.localeCompare(second.listing.id);
}

function wouldExceedConsecutiveLimit(selected: RankingCandidate[], candidate: RankingCandidate) {
  if (selected.length < MAX_CONSECUTIVE_LISTINGS_PER_AGENT) return false;
  return selected
    .slice(-MAX_CONSECUTIVE_LISTINGS_PER_AGENT)
    .every((item) => item.listing.agentId === candidate.listing.agentId);
}

function addDeferredAdjustment(
  adjustments: Map<string, Set<ListingDiversityAdjustment>>,
  listingId: string,
  adjustment: ListingDiversityAdjustment
) {
  const current = adjustments.get(listingId) ?? new Set<ListingDiversityAdjustment>();
  current.add(adjustment);
  adjustments.set(listingId, current);
}

function takeCandidate(
  remaining: RankingCandidate[],
  selected: RankingCandidate[],
  pageAgentCounts: Map<string, number>,
  deferredAdjustments: Map<string, Set<ListingDiversityAdjustment>>
) {
  function findCandidate(options: { enforcePageLimit: boolean; enforceConsecutiveLimit: boolean }) {
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const pageLimitExceeded =
        (pageAgentCounts.get(candidate.listing.agentId) ?? 0) >= MAX_LISTINGS_PER_AGENT_PER_PAGE;
      const consecutiveLimitExceeded = wouldExceedConsecutiveLimit(selected, candidate);

      if (options.enforcePageLimit && pageLimitExceeded) {
        addDeferredAdjustment(deferredAdjustments, candidate.listing.id, "page_limit");
        continue;
      }
      if (options.enforceConsecutiveLimit && consecutiveLimitExceeded) {
        addDeferredAdjustment(deferredAdjustments, candidate.listing.id, "consecutive_limit");
        continue;
      }
      return index;
    }
    return -1;
  }

  let selectedIndex = findCandidate({ enforcePageLimit: true, enforceConsecutiveLimit: true });
  let relaxed = false;

  if (selectedIndex < 0) {
    selectedIndex = findCandidate({ enforcePageLimit: false, enforceConsecutiveLimit: true });
    relaxed = selectedIndex >= 0;
  }
  if (selectedIndex < 0) {
    selectedIndex = findCandidate({ enforcePageLimit: true, enforceConsecutiveLimit: false });
    relaxed = selectedIndex >= 0;
  }
  if (selectedIndex < 0 && remaining.length) {
    selectedIndex = 0;
    relaxed = true;
  }
  if (selectedIndex < 0) return null;

  const [candidate] = remaining.splice(selectedIndex, 1);
  if (relaxed) addDeferredAdjustment(deferredAdjustments, candidate.listing.id, "relaxed");
  return candidate;
}

export function rankListingsForFeedWithDiagnostics(
  listings: ListingRecord[],
  limit = listings.length,
  now = new Date()
): RankedListing[] {
  const targetCount = Math.min(Math.max(0, Math.trunc(limit)), listings.length);
  const ranked = listings
    .filter((listing) => isListingFeedEligible(listing, now))
    .map((listing) => ({ listing, breakdown: getListingRankingBreakdown(listing, now) }))
    .sort(compareCandidates);

  const eligibleTargetCount = Math.min(targetCount, ranked.length);
  const fixedPlacements = new Map<number, RankingCandidate>();
  const fixedListingIds = new Set<string>();
  const premiumCandidates = ranked.filter(({ breakdown }) => breakdown.promotionTier === "premium");

  PREMIUM_SLOTS.forEach((position, index) => {
    const candidate = premiumCandidates[index];
    if (!candidate || position >= eligibleTargetCount) return;
    fixedPlacements.set(position, candidate);
    fixedListingIds.add(candidate.listing.id);
  });

  const remaining = ranked.filter(({ listing }) => !fixedListingIds.has(listing.id));
  const selected: RankingCandidate[] = [];
  const deferredAdjustments = new Map<string, Set<ListingDiversityAdjustment>>();

  for (let pageStart = 0; pageStart < eligibleTargetCount; pageStart += RANKING_PAGE_SIZE) {
    const pageEnd = Math.min(pageStart + RANKING_PAGE_SIZE, eligibleTargetCount);
    const pageAgentCounts = new Map<string, number>();

    for (let position = pageStart; position < pageEnd; position += 1) {
      const fixedCandidate = fixedPlacements.get(position);
      if (!fixedCandidate) continue;
      pageAgentCounts.set(
        fixedCandidate.listing.agentId,
        (pageAgentCounts.get(fixedCandidate.listing.agentId) ?? 0) + 1
      );
    }

    for (let position = pageStart; position < pageEnd; position += 1) {
      const fixedCandidate = fixedPlacements.get(position);
      if (fixedCandidate) {
        selected.push(fixedCandidate);
        continue;
      }

      const candidate = takeCandidate(remaining, selected, pageAgentCounts, deferredAdjustments);
      if (!candidate) break;
      selected.push(candidate);
      pageAgentCounts.set(
        candidate.listing.agentId,
        (pageAgentCounts.get(candidate.listing.agentId) ?? 0) + 1
      );
    }
  }

  return selected.map((candidate, index) => ({
    listing: candidate.listing,
    position: index + 1,
    breakdown: {
      ...candidate.breakdown,
      fixedPremiumSlot: fixedPlacements.get(index)?.listing.id === candidate.listing.id,
      diversityAdjustments: Array.from(deferredAdjustments.get(candidate.listing.id) ?? [])
    }
  }));
}

export function rankListingsForFeed(listings: ListingRecord[], limit = listings.length, now = new Date()) {
  return rankListingsForFeedWithDiagnostics(listings, limit, now).map(({ listing }) => listing);
}
