import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getMarketIndexability,
  MARKET_INDEX_GRACE_DAYS,
  type PropertyMarketRoute,
  type PropertyMarketStats
} from "@/lib/property-search";

type SeoMarketState = {
  path: string;
  is_indexable: boolean;
  below_threshold_since: string | null;
};

function isMissingSeoTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || /seo_market_pages/i.test(error?.message ?? "");
}

export type MarketIndexDecision = ReturnType<typeof getMarketIndexability> & {
  inGracePeriod: boolean;
};

export async function resolveMarketIndexability(
  route: PropertyMarketRoute,
  stats: PropertyMarketStats,
  now = new Date()
): Promise<MarketIndexDecision> {
  const baseline = getMarketIndexability(route, stats, now);
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("seo_market_pages")
    .select("path, is_indexable, below_threshold_since")
    .eq("path", route.path)
    .maybeSingle();

  if (error && !isMissingSeoTable(error)) {
    console.warn("[seo] could not read market index history", { path: route.path, message: error.message });
  }
  if (error && isMissingSeoTable(error)) {
    return { ...baseline, inGracePeriod: false };
  }

  const previous = data as SeoMarketState | null;
  let eligible = baseline.eligible;
  let reason = baseline.reason;
  let belowThresholdSince: string | null = null;
  let inGracePeriod = false;

  if (!baseline.eligible && previous?.is_indexable) {
    belowThresholdSince = previous.below_threshold_since ?? now.toISOString();
    const graceEnd = new Date(belowThresholdSince).getTime() + MARKET_INDEX_GRACE_DAYS * 24 * 60 * 60 * 1000;
    if (now.getTime() < graceEnd) {
      eligible = true;
      inGracePeriod = true;
      reason = `Temporarily retained during the ${MARKET_INDEX_GRACE_DAYS}-day inventory grace period.`;
    }
  }

  const { error: writeError } = await supabase.from("seo_market_pages").upsert(
    {
      path: route.path,
      page_type: route.kind,
      state: route.state ?? null,
      city: route.city ?? null,
      area_slug: route.areaSlug ?? null,
      listing_category: route.category ?? null,
      property_type: route.propertyType ?? null,
      property_subtype: route.propertySubtype ?? null,
      listing_count: stats.listingCount,
      is_indexable: eligible,
      eligibility_reason: reason,
      first_eligible_at:
        baseline.eligible && !previous?.is_indexable ? now.toISOString() : undefined,
      below_threshold_since: baseline.eligible ? null : belowThresholdSince ?? now.toISOString(),
      last_evaluated_at: now.toISOString()
    },
    { onConflict: "path" }
  );

  if (writeError && !isMissingSeoTable(writeError)) {
    console.warn("[seo] could not persist market index history", {
      path: route.path,
      message: writeError.message
    });
  }

  return { ...baseline, eligible, reason, inGracePeriod };
}
