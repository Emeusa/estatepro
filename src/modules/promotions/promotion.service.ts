import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ListingRecord, PromotionCreditType } from "@/lib/types";
import { getAgentProfile } from "@/modules/agents/agent.repository";
import { consumePromotionCredit } from "@/modules/entitlements/entitlement.repository";
import { getAgentEntitlements, syncAgentPlanCredits } from "@/modules/entitlements/entitlement.service";
import { ensureAgentOwnsListing, ensureAgentCanManageListings, getListingDetails } from "@/modules/listings/listing.service";
import { updateListing } from "@/modules/listings/listing.repository";

export const listingPromotionSchema = z.object({
  promotionType: z.enum(["boost", "featured", "sponsored"])
});

const BOOST_COOLDOWN_HOURS = 24;

function creditTypeForPromotion(promotionType: z.infer<typeof listingPromotionSchema>["promotionType"]): PromotionCreditType {
  return promotionType === "boost" ? "boost" : promotionType;
}

function promotionEndDate(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function assertPromotableListing(listing: ListingRecord) {
  if (listing.status !== "active") {
    throw new Error("Only active listings can be promoted.");
  }
  if (listing.availability !== "available") {
    throw new Error("Only available listings can be promoted.");
  }
}

function isFuture(value?: string | null) {
  return value ? new Date(value).getTime() > Date.now() : false;
}

function assertPromotionNotActive(listing: ListingRecord, promotionType: z.infer<typeof listingPromotionSchema>["promotionType"]) {
  if (promotionType === "boost" && listing.boostedAt) {
    const nextBoostAt = new Date(listing.boostedAt).getTime() + BOOST_COOLDOWN_HOURS * 60 * 60 * 1000;
    if (nextBoostAt > Date.now()) {
      throw new Error("This listing was already boosted recently. You can boost it again after 24 hours.");
    }
  }
  if (promotionType === "sponsored" && isFuture(listing.sponsoredUntil)) {
    throw new Error("This listing is already sponsored until the current sponsored period expires.");
  }
  if (promotionType === "featured" && isFuture(listing.featuredUntil)) {
    throw new Error("This listing is already featured until the current featured period expires.");
  }
}

async function recordListingPromotion(input: {
  agentId: string;
  listingId: string;
  promotionType: "featured" | "sponsored";
  startsAt: string;
  endsAt: string;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("listing_promotions").insert({
    agent_id: input.agentId,
    listing_id: input.listingId,
    promotion_type: input.promotionType,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    status: "active"
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function applyListingPromotion(agentId: string, listingId: string, input: unknown) {
  const { promotionType } = listingPromotionSchema.parse(input);
  const { subscription } = await getAgentProfile(agentId);
  await ensureAgentCanManageListings(agentId);
  await syncAgentPlanCredits(agentId, subscription);

  const listing = await ensureAgentOwnsListing(agentId, listingId);
  assertPromotableListing(listing);
  assertPromotionNotActive(listing, promotionType);

  const creditType = creditTypeForPromotion(promotionType);
  await consumePromotionCredit({
    agentId,
    listingId,
    creditType,
    action: promotionType,
    metadata: { promotionType }
  });

  const now = new Date().toISOString();
  let updatedListing: ListingRecord;

  if (promotionType === "boost") {
    updatedListing = await updateListing(listingId, {
      boostedAt: now,
      lastRefreshedAt: now
    });
  } else {
    const endsAt = promotionEndDate();
    await recordListingPromotion({
      agentId,
      listingId,
      promotionType,
      startsAt: now,
      endsAt
    });
    updatedListing = await updateListing(listingId, {
      promotionType,
      ...(promotionType === "featured" ? { featuredUntil: endsAt } : { sponsoredUntil: endsAt })
    });
  }

  const entitlements = await getAgentEntitlements(agentId, subscription);
  return {
    listing: (await getListingDetails(updatedListing.id)) ?? updatedListing,
    entitlements
  };
}
