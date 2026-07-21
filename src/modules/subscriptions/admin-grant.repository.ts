import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toSubscriptionAdminGrantRecord, toSubscriptionRecord } from "@/lib/supabase-mappers";
import { SubscriptionAdminGrantRecord, SubscriptionRecord } from "@/lib/types";
import { AdminGrantPlanSlug } from "@/modules/subscriptions/admin-grant.schema";

export async function upsertManualSubscription(input: {
  agentId: string;
  planSlug: AdminGrantPlanSlug;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
}) {
  const supabase = createServerSupabaseClient();
  const fallbackTrialEnd = input.currentPeriodEnd ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        agent_id: input.agentId,
        plan_slug: input.planSlug,
        payment_provider: "manual",
        billing_mode: "prepaid",
        paystack_customer_code: null,
        paystack_subscription_code: null,
        paystack_email_token: null,
        paystack_plan_code: null,
        opay_order_no: null,
        opay_transaction_id: null,
        current_period_start: input.currentPeriodStart,
        current_period_end: input.currentPeriodEnd,
        cancel_at_period_end: false,
        status: "active",
        trial_starts_at: input.currentPeriodStart,
        trial_ends_at: fallbackTrialEnd,
        is_active: true
      },
      { onConflict: "agent_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update manual subscription.");
  }

  return toSubscriptionRecord(data);
}

export async function insertSubscriptionAdminGrant(input: {
  agentId: string;
  adminId: string;
  planSlug: AdminGrantPlanSlug;
  periodStart: string;
  periodEnd: string | null;
  reason: string;
  previousSubscription: SubscriptionRecord | null;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscription_admin_grants")
    .insert({
      agent_id: input.agentId,
      admin_id: input.adminId,
      plan_slug: input.planSlug,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      reason: input.reason,
      previous_plan_slug: input.previousSubscription?.planSlug ?? null,
      previous_status: input.previousSubscription?.status ?? null,
      previous_period_end: input.previousSubscription?.currentPeriodEnd ?? null
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not record subscription grant.");
  }

  return toSubscriptionAdminGrantRecord(data);
}

export async function listSubscriptionAdminGrantsForAgent(agentId: string, limit = 5): Promise<SubscriptionAdminGrantRecord[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscription_admin_grants")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(Math.trunc(limit), 20)));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toSubscriptionAdminGrantRecord);
}
