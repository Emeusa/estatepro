import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PromotionCreditSummary, PromotionCreditType } from "@/lib/types";

type PromotionCreditRow = {
  credit_type: PromotionCreditType;
  quantity: number;
  remaining: number;
  period_start: string | null;
  period_end: string | null;
};

const CREDIT_TYPES: PromotionCreditType[] = ["boost", "featured", "sponsored"];

function emptyCredit(creditType: PromotionCreditType): PromotionCreditSummary {
  return {
    creditType,
    quantity: 0,
    remaining: 0,
    periodStart: null,
    periodEnd: null
  };
}

export function emptyCreditMap() {
  return CREDIT_TYPES.reduce(
    (credits, creditType) => ({
      ...credits,
      [creditType]: emptyCredit(creditType)
    }),
    {} as Record<PromotionCreditType, PromotionCreditSummary>
  );
}

export async function grantPlanPromotionCredits(input: {
  agentId: string;
  planSlug: string;
  periodStart: string;
  periodEnd: string;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc("grant_plan_promotion_credits", {
    p_agent_id: input.agentId,
    p_plan_slug: input.planSlug,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listCurrentPromotionCredits(agentId: string) {
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("promotion_credits")
    .select("credit_type, quantity, remaining, period_start, period_end")
    .eq("agent_id", agentId)
    .lte("period_start", now)
    .gt("period_end", now)
    .order("period_end", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const credits = emptyCreditMap();
  for (const row of (data ?? []) as PromotionCreditRow[]) {
    credits[row.credit_type] = {
      creditType: row.credit_type,
      quantity: row.quantity,
      remaining: row.remaining,
      periodStart: row.period_start,
      periodEnd: row.period_end
    };
  }

  return credits;
}

export async function countActiveAvailableListings(agentId: string) {
  const supabase = createServerSupabaseClient();
  const { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("status", "active")
    .eq("availability", "available");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function consumePromotionCredit(input: {
  agentId: string;
  listingId: string;
  creditType: PromotionCreditType;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc("consume_promotion_credit", {
    p_agent_id: input.agentId,
    p_credit_type: input.creditType,
    p_listing_id: input.listingId,
    p_action: input.action,
    p_metadata: input.metadata ?? {}
  });

  if (error) {
    throw new Error(error.message);
  }
}
