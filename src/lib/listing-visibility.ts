import { getListingImageCount } from "@/lib/listing-images";
import { ListingRecord } from "@/lib/types";

const SPONSORED_SLOTS = [0, 4, 11];

function isFuture(value?: string | null) {
  return value ? new Date(value).getTime() > Date.now() : false;
}

function daysSince(value?: string | null) {
  if (!value) {
    return 365;
  }

  return Math.max(0, (Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function deterministicExplorationScore(id: string) {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  }
  return (hash / 996) * 100;
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

function freshnessScore(listing: ListingRecord) {
  const latestActivity = [listing.boostedAt, listing.lastRefreshedAt, listing.createdAt]
    .filter(Boolean)
    .sort((first, second) => new Date(second as string).getTime() - new Date(first as string).getTime())[0];
  const ageInDays = daysSince(latestActivity);
  return clampScore(100 - ageInDays * 3.5);
}

function promotionScore(listing: ListingRecord) {
  if (isFuture(listing.sponsoredUntil)) return 100;
  if (isFuture(listing.featuredUntil)) return 82;
  if (listing.promotionType === "premium") return 58;
  return 0;
}

export function getListingPromotionBadge(
  listing: Pick<ListingRecord, "sponsoredUntil" | "featuredUntil" | "promotionType">
) {
  if (isFuture(listing.sponsoredUntil)) return "Sponsored";
  if (isFuture(listing.featuredUntil)) return "Featured";
  if (listing.promotionType === "premium") return "Premium";
  return null;
}

export function isListingFeedEligible(listing: ListingRecord) {
  if (listing.status !== "active" || listing.availability !== "available") return false;
  if (getListingImageCount(listing) < 1) return false;
  if (listing.expiresAt && !isFuture(listing.expiresAt)) return false;
  return true;
}

export function getListingVisibilityScore(listing: ListingRecord) {
  const trustScore = 82;
  const engagementScore = 50;
  const explorationScore = deterministicExplorationScore(listing.id);

  return (
    qualityScore(listing) * 0.25 +
    freshnessScore(listing) * 0.2 +
    trustScore * 0.2 +
    engagementScore * 0.15 +
    promotionScore(listing) * 0.15 +
    explorationScore * 0.05
  );
}

export function rankListingsForFeed(listings: ListingRecord[], limit: number) {
  const ranked = listings
    .filter(isListingFeedEligible)
    .map((listing) => ({ listing, score: getListingVisibilityScore(listing) }))
    .sort((first, second) => second.score - first.score);

  const sponsored = ranked.filter(({ listing }) => isFuture(listing.sponsoredUntil));
  const organic = ranked.filter(({ listing }) => !isFuture(listing.sponsoredUntil));
  const selected: ListingRecord[] = [];
  const perAgentCounts = new Map<string, number>();

  for (const { listing } of organic) {
    if (selected.length >= limit) break;
    const currentCount = perAgentCounts.get(listing.agentId) ?? 0;
    if (currentCount >= 2) continue;
    selected.push(listing);
    perAgentCounts.set(listing.agentId, currentCount + 1);
  }

  for (const { listing } of organic) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.id === listing.id)) {
      selected.push(listing);
    }
  }

  for (const [slotIndex, { listing }] of sponsored.entries()) {
    const position = SPONSORED_SLOTS[slotIndex] ?? selected.length;
    if (selected.some((item) => item.id === listing.id)) continue;
    selected.splice(Math.min(position, selected.length), 0, listing);
  }

  return selected.slice(0, limit);
}
