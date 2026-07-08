import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toSubscriptionRecord } from "@/lib/supabase-mappers";
import { PaidPricingPlanSlug } from "@/lib/pricing";
import { BillingMode, BillingProvider, SubscriptionRecord } from "@/lib/types";

export type BillingTransactionRecord = {
  id: string;
  agentId: string;
  reference: string;
  planSlug: PaidPricingPlanSlug;
  paymentProvider: BillingProvider;
  billingMode: BillingMode;
  paystackPlanCode: string | null;
  amountKobo: number;
  currency: string;
  status: "pending" | "success" | "failed" | "abandoned";
  authorizationUrl: string | null;
  accessCode: string | null;
  paystackTransactionId: string | null;
  paystackCustomerCode: string | null;
  paystackSubscriptionCode: string | null;
  opayOrderNo: string | null;
  opayTransactionId: string | null;
};

type BillingTransactionRow = {
  id: string;
  agent_id: string;
  reference: string;
  plan_slug: PaidPricingPlanSlug;
  payment_provider?: BillingProvider | null;
  billing_mode?: BillingMode | null;
  paystack_plan_code: string | null;
  amount_kobo: number;
  currency: string;
  status: BillingTransactionRecord["status"];
  authorization_url: string | null;
  access_code: string | null;
  paystack_transaction_id: string | null;
  paystack_customer_code: string | null;
  paystack_subscription_code: string | null;
  opay_order_no?: string | null;
  opay_transaction_id?: string | null;
};

function toBillingTransaction(row: BillingTransactionRow): BillingTransactionRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    reference: row.reference,
    planSlug: row.plan_slug,
    paymentProvider: row.payment_provider ?? "paystack",
    billingMode: row.billing_mode ?? "recurring",
    paystackPlanCode: row.paystack_plan_code,
    amountKobo: row.amount_kobo,
    currency: row.currency,
    status: row.status,
    authorizationUrl: row.authorization_url,
    accessCode: row.access_code,
    paystackTransactionId: row.paystack_transaction_id,
    paystackCustomerCode: row.paystack_customer_code,
    paystackSubscriptionCode: row.paystack_subscription_code,
    opayOrderNo: row.opay_order_no ?? null,
    opayTransactionId: row.opay_transaction_id ?? null
  };
}

export async function createBillingTransaction(input: {
  agentId: string;
  reference: string;
  planSlug: PaidPricingPlanSlug;
  paymentProvider: BillingProvider;
  billingMode: BillingMode;
  paystackPlanCode: string | null;
  amountKobo: number;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .insert({
      agent_id: input.agentId,
      reference: input.reference,
      plan_slug: input.planSlug,
      payment_provider: input.paymentProvider,
      billing_mode: input.billingMode,
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
  opayOrderNo?: string | null;
}) {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("billing_transactions")
    .update({
      authorization_url: input.authorizationUrl,
      access_code: input.accessCode,
      ...(input.opayOrderNo !== undefined ? { opay_order_no: input.opayOrderNo } : {}),
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
  paystackTransactionId?: string | null;
  paystackCustomerCode?: string | null;
  paystackSubscriptionCode?: string | null;
  opayTransactionId?: string | null;
  opayOrderNo?: string | null;
  rawResponse: unknown;
}) {
  const payload: Record<string, unknown> = {
    status: "success",
    raw_response: input.rawResponse,
    updated_at: new Date().toISOString()
  };
  if (input.paystackTransactionId !== undefined) payload.paystack_transaction_id = input.paystackTransactionId;
  if (input.paystackCustomerCode !== undefined) payload.paystack_customer_code = input.paystackCustomerCode;
  if (input.paystackSubscriptionCode !== undefined) payload.paystack_subscription_code = input.paystackSubscriptionCode;
  if (input.opayTransactionId !== undefined) payload.opay_transaction_id = input.opayTransactionId;
  if (input.opayOrderNo !== undefined) payload.opay_order_no = input.opayOrderNo;

  const supabase = createServerSupabaseClient();
  await supabase
    .from("billing_transactions")
    .update(payload)
    .eq("reference", input.reference);
}

export async function upsertActiveSubscription(input: {
  agentId: string;
  planSlug: PaidPricingPlanSlug;
  paymentProvider: BillingProvider;
  billingMode: BillingMode;
  paystackPlanCode?: string | null;
  paystackCustomerCode?: string | null;
  paystackSubscriptionCode?: string | null;
  paystackEmailToken?: string | null;
  opayOrderNo?: string | null;
  opayTransactionId?: string | null;
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
        payment_provider: input.paymentProvider,
        billing_mode: input.billingMode,
        paystack_plan_code: input.paystackPlanCode ?? null,
        paystack_customer_code: input.paystackCustomerCode ?? null,
        paystack_subscription_code: input.paystackSubscriptionCode ?? null,
        paystack_email_token: input.paystackEmailToken ?? null,
        opay_order_no: input.opayOrderNo ?? null,
        opay_transaction_id: input.opayTransactionId ?? null,
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
    paymentProvider: BillingProvider;
    billingMode: BillingMode;
    opayOrderNo: string | null;
    opayTransactionId: string | null;
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
  if (updates.paymentProvider !== undefined) payload.payment_provider = updates.paymentProvider;
  if (updates.billingMode !== undefined) payload.billing_mode = updates.billingMode;
  if (updates.opayOrderNo !== undefined) payload.opay_order_no = updates.opayOrderNo;
  if (updates.opayTransactionId !== undefined) payload.opay_transaction_id = updates.opayTransactionId;
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
