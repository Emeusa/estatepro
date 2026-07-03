import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toSubscriptionRecord } from "@/lib/supabase-mappers";
import { PaidPricingPlanSlug } from "@/lib/pricing";
import { SubscriptionRecord } from "@/lib/types";

export type BillingTransactionRecord = {
  id: string;
  agentId: string;
  reference: string;
  planSlug: PaidPricingPlanSlug;
  paystackPlanCode: string;
  amountKobo: number;
  currency: string;
  status: "pending" | "success" | "failed" | "abandoned";
  authorizationUrl: string | null;
  accessCode: string | null;
  paystackTransactionId: string | null;
  paystackCustomerCode: string | null;
  paystackSubscriptionCode: string | null;
};

type BillingTransactionRow = {
  id: string;
  agent_id: string;
  reference: string;
  plan_slug: PaidPricingPlanSlug;
  paystack_plan_code: string;
  amount_kobo: number;
  currency: string;
  status: BillingTransactionRecord["status"];
  authorization_url: string | null;
  access_code: string | null;
  paystack_transaction_id: string | null;
  paystack_customer_code: string | null;
  paystack_subscription_code: string | null;
};

function toBillingTransaction(row: BillingTransactionRow): BillingTransactionRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    reference: row.reference,
    planSlug: row.plan_slug,
    paystackPlanCode: row.paystack_plan_code,
    amountKobo: row.amount_kobo,
    currency: row.currency,
    status: row.status,
    authorizationUrl: row.authorization_url,
    accessCode: row.access_code,
    paystackTransactionId: row.paystack_transaction_id,
    paystackCustomerCode: row.paystack_customer_code,
    paystackSubscriptionCode: row.paystack_subscription_code
  };
}

export async function createBillingTransaction(input: {
  agentId: string;
  reference: string;
  planSlug: PaidPricingPlanSlug;
  paystackPlanCode: string;
  amountKobo: number;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .insert({
      agent_id: input.agentId,
      reference: input.reference,
      plan_slug: input.planSlug,
      paystack_plan_code: input.paystackPlanCode,
      amount_kobo: input.amountKobo,
      currency: "NGN",
      status: "pending"
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create billing transaction.");
  }

  return toBillingTransaction(data);
}

export async function updateBillingTransactionInitialized(input: {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
}) {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("billing_transactions")
    .update({
      authorization_url: input.authorizationUrl,
      access_code: input.accessCode,
      updated_at: new Date().toISOString()
    })
    .eq("reference", input.reference);
}

export async function getBillingTransactionByReference(reference: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .select("*")
    .eq("reference", reference)
    .single();

  if (error || !data) {
    return null;
  }

  return toBillingTransaction(data);
}

export async function markBillingTransactionFailed(reference: string, rawResponse: unknown) {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("billing_transactions")
    .update({
      status: "failed",
      raw_response: rawResponse,
      updated_at: new Date().toISOString()
    })
    .eq("reference", reference);
}

export async function markBillingTransactionSuccess(input: {
  reference: string;
  paystackTransactionId: string | null;
  paystackCustomerCode: string | null;
  paystackSubscriptionCode: string | null;
  rawResponse: unknown;
}) {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("billing_transactions")
    .update({
      status: "success",
      paystack_transaction_id: input.paystackTransactionId,
      paystack_customer_code: input.paystackCustomerCode,
      paystack_subscription_code: input.paystackSubscriptionCode,
      raw_response: input.rawResponse,
      updated_at: new Date().toISOString()
    })
    .eq("reference", input.reference);
}

export async function upsertActiveSubscription(input: {
  agentId: string;
  planSlug: PaidPricingPlanSlug;
  paystackPlanCode: string;
  paystackCustomerCode: string | null;
  paystackSubscriptionCode: string | null;
  paystackEmailToken: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        agent_id: input.agentId,
        plan_slug: input.planSlug,
        paystack_plan_code: input.paystackPlanCode,
        paystack_customer_code: input.paystackCustomerCode,
        paystack_subscription_code: input.paystackSubscriptionCode,
        paystack_email_token: input.paystackEmailToken,
        current_period_start: input.currentPeriodStart,
        current_period_end: input.currentPeriodEnd,
        cancel_at_period_end: false,
        status: "active",
        is_active: true,
        trial_starts_at: input.currentPeriodStart,
        trial_ends_at: input.currentPeriodEnd
      },
      { onConflict: "agent_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update subscription.");
  }

  return toSubscriptionRecord(data);
}

export async function getSubscriptionByAgentId(agentId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("subscriptions").select("*").eq("agent_id", agentId).single();
  if (error || !data) {
    return null;
  }
  return toSubscriptionRecord(data);
}

export async function getSubscriptionByPaystackSubscriptionCode(subscriptionCode: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("paystack_subscription_code", subscriptionCode)
    .single();
  if (error || !data) {
    return null;
  }
  return toSubscriptionRecord(data);
}

export async function getSubscriptionByPaystackCustomerCode(customerCode: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("paystack_customer_code", customerCode)
    .single();
  if (error || !data) {
    return null;
  }
  return toSubscriptionRecord(data);
}

export async function updateSubscriptionBillingState(
  agentId: string,
  updates: Partial<{
    paystackCustomerCode: string | null;
    paystackSubscriptionCode: string | null;
    paystackEmailToken: string | null;
    status: SubscriptionRecord["status"];
    isActive: boolean;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  }>
) {
  const payload: Record<string, unknown> = {};
  if (updates.paystackCustomerCode !== undefined) payload.paystack_customer_code = updates.paystackCustomerCode;
  if (updates.paystackSubscriptionCode !== undefined) payload.paystack_subscription_code = updates.paystackSubscriptionCode;
  if (updates.paystackEmailToken !== undefined) payload.paystack_email_token = updates.paystackEmailToken;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  if (updates.cancelAtPeriodEnd !== undefined) payload.cancel_at_period_end = updates.cancelAtPeriodEnd;
  if (updates.currentPeriodStart !== undefined) payload.current_period_start = updates.currentPeriodStart;
  if (updates.currentPeriodEnd !== undefined) payload.current_period_end = updates.currentPeriodEnd;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .update(payload)
    .eq("agent_id", agentId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update subscription.");
  }

  return toSubscriptionRecord(data);
}
