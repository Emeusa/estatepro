import {
  createBillingReference,
  disablePaystackSubscription,
  getFallbackPeriodEnd,
  getPaystackPlanCode,
  getPaystackPlanCodeFromTransaction,
  getPlanSlugForPaystackCode,
  initializePaystackTransaction,
  parsePaystackMetadata,
  PaystackTransactionData,
  verifyPaystackTransaction
} from "@/lib/paystack";
import { isBillingLiveEnabled } from "@/lib/billing-config";
import { getPlanAmountKobo, isPaidPricingPlanSlug } from "@/lib/pricing";
import { getAgentProfile } from "@/modules/agents/agent.repository";
import {
  createBillingTransaction,
  getBillingTransactionByReference,
  getSubscriptionByAgentId,
  getSubscriptionByPaystackCustomerCode,
  getSubscriptionByPaystackSubscriptionCode,
  markBillingTransactionFailed,
  markBillingTransactionSuccess,
  updateBillingTransactionInitialized,
  updateSubscriptionBillingState,
  upsertActiveSubscription
} from "@/modules/billing/billing.repository";

type PaystackWebhookEvent = {
  event: string;
  data?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readCustomerCode(data: Record<string, unknown>) {
  const customer = asRecord(data.customer);
  return readString(customer.customer_code) ?? readString(data.customer_code);
}

function readSubscriptionCode(data: Record<string, unknown>) {
  const subscription = asRecord(data.subscription);
  return readString(subscription.subscription_code) ?? readString(data.subscription_code);
}

function readSubscriptionToken(data: Record<string, unknown>) {
  const subscription = asRecord(data.subscription);
  return readString(subscription.email_token) ?? readString(data.email_token);
}

function readPlanCode(data: Record<string, unknown>) {
  const plan = asRecord(data.plan);
  const planObject = asRecord(data.plan_object);
  return readString(plan.plan_code) ?? readString(planObject.plan_code) ?? readString(data.plan_code) ?? readString(data.plan);
}

function readPeriodStart(data: Record<string, unknown>) {
  return readString(data.current_period_start) ?? readString(data.period_start) ?? new Date().toISOString();
}

function readPeriodEnd(data: Record<string, unknown>) {
  return readString(data.current_period_end) ?? readString(data.period_end) ?? getFallbackPeriodEnd();
}

function transactionId(transaction: PaystackTransactionData) {
  return transaction.id === undefined ? null : String(transaction.id);
}

function assertSuccessfulTransaction(
  transaction: PaystackTransactionData,
  expected: {
    reference: string;
    amountKobo: number;
    currency: string;
    planCode: string;
    agentId: string;
  }
) {
  if (transaction.status !== "success") {
    throw new Error("Payment was not successful.");
  }

  if (transaction.reference !== expected.reference) {
    throw new Error("Payment reference mismatch.");
  }

  if (transaction.amount !== expected.amountKobo || transaction.currency !== expected.currency) {
    throw new Error("Payment amount mismatch.");
  }

  const transactionPlanCode = getPaystackPlanCodeFromTransaction(transaction);
  if (transactionPlanCode && transactionPlanCode !== expected.planCode) {
    throw new Error("Payment plan mismatch.");
  }

  const metadata = parsePaystackMetadata(transaction.metadata);
  if (metadata.agentId && metadata.agentId !== expected.agentId) {
    throw new Error("Payment account mismatch.");
  }
}

export async function startBillingCheckout(input: {
  agentId: string;
  email: string;
  planSlug: string;
}) {
  if (!isBillingLiveEnabled()) {
    throw new Error("Paid billing is not live yet. Complete the live Paystack verification before accepting payments.");
  }

  if (!isPaidPricingPlanSlug(input.planSlug)) {
    throw new Error("Select a paid monthly plan to continue.");
  }

  const { agent, subscription } = await getAgentProfile(input.agentId);
  if (!agent) {
    throw new Error("Agent profile was not found.");
  }
  if (agent.isBlocked || agent.verificationStatus !== "approved") {
    throw new Error("Your agent account must be approved and active before upgrading.");
  }
  if (subscription?.planSlug === input.planSlug && subscription.isActive && !subscription.cancelAtPeriodEnd) {
    throw new Error("You are already on this plan.");
  }

  const reference = createBillingReference();
  const paystackPlanCode = getPaystackPlanCode(input.planSlug);
  const amountKobo = getPlanAmountKobo(input.planSlug);

  await createBillingTransaction({
    agentId: input.agentId,
    reference,
    planSlug: input.planSlug,
    paystackPlanCode,
    amountKobo
  });

  try {
    const checkout = await initializePaystackTransaction({
      email: input.email,
      planSlug: input.planSlug,
      reference,
      metadata: {
        agentId: input.agentId,
        planSlug: input.planSlug,
        reference,
        kind: "agent_subscription"
      }
    });

    await updateBillingTransactionInitialized({
      reference,
      authorizationUrl: checkout.authorization_url,
      accessCode: checkout.access_code
    });

    return {
      authorizationUrl: checkout.authorization_url,
      reference
    };
  } catch (error) {
    await markBillingTransactionFailed(reference, {
      message: error instanceof Error ? error.message : "Paystack checkout failed."
    });
    throw error;
  }
}

export async function applySuccessfulPaystackTransaction(reference: string) {
  const billingTransaction = await getBillingTransactionByReference(reference);
  if (!billingTransaction) {
    throw new Error("Billing transaction was not found.");
  }

  const transaction = await verifyPaystackTransaction(reference);
  try {
    assertSuccessfulTransaction(transaction, {
      reference,
      amountKobo: billingTransaction.amountKobo,
      currency: billingTransaction.currency,
      planCode: billingTransaction.paystackPlanCode,
      agentId: billingTransaction.agentId
    });
  } catch (error) {
    await markBillingTransactionFailed(reference, transaction);
    throw error;
  }

  const customerCode = transaction.customer?.customer_code ?? null;
  const subscriptionCode = transaction.subscription?.subscription_code ?? null;
  const emailToken = transaction.subscription?.email_token ?? null;
  const now = new Date().toISOString();
  const subscription = await upsertActiveSubscription({
    agentId: billingTransaction.agentId,
    planSlug: billingTransaction.planSlug,
    paystackPlanCode: billingTransaction.paystackPlanCode,
    paystackCustomerCode: customerCode,
    paystackSubscriptionCode: subscriptionCode,
    paystackEmailToken: emailToken,
    currentPeriodStart: now,
    currentPeriodEnd: getFallbackPeriodEnd(new Date(now))
  });

  await markBillingTransactionSuccess({
    reference,
    paystackTransactionId: transactionId(transaction),
    paystackCustomerCode: customerCode,
    paystackSubscriptionCode: subscriptionCode,
    rawResponse: transaction
  });

  return subscription;
}

async function resolveWebhookAgentId(data: Record<string, unknown>) {
  const metadata = parsePaystackMetadata(data.metadata);
  if (metadata.agentId) {
    return metadata.agentId;
  }

  const subscriptionCode = readSubscriptionCode(data);
  if (subscriptionCode) {
    const subscription = await getSubscriptionByPaystackSubscriptionCode(subscriptionCode);
    if (subscription) {
      return subscription.agentId;
    }
  }

  const customerCode = readCustomerCode(data);
  if (customerCode) {
    const subscription = await getSubscriptionByPaystackCustomerCode(customerCode);
    if (subscription) {
      return subscription.agentId;
    }
  }

  return null;
}

async function applyWebhookSubscriptionUpdate(data: Record<string, unknown>) {
  const agentId = await resolveWebhookAgentId(data);
  const planCode = readPlanCode(data);
  const planSlug = getPlanSlugForPaystackCode(planCode);

  if (!agentId || !planCode || !planSlug) {
    return;
  }

  await upsertActiveSubscription({
    agentId,
    planSlug,
    paystackPlanCode: planCode,
    paystackCustomerCode: readCustomerCode(data),
    paystackSubscriptionCode: readSubscriptionCode(data),
    paystackEmailToken: readSubscriptionToken(data),
    currentPeriodStart: readPeriodStart(data),
    currentPeriodEnd: readPeriodEnd(data)
  });
}

async function applyWebhookFailureOrDisable(data: Record<string, unknown>, status: "past_due" | "cancelled") {
  const agentId = await resolveWebhookAgentId(data);
  if (!agentId) {
    return;
  }

  await updateSubscriptionBillingState(agentId, {
    status,
    isActive: false,
    cancelAtPeriodEnd: status === "cancelled"
  });
}

export async function processPaystackWebhook(event: PaystackWebhookEvent) {
  const data = asRecord(event.data);

  if (event.event === "charge.success") {
    const reference = readString(data.reference);
    if (reference) {
      await applySuccessfulPaystackTransaction(reference);
    }
    return;
  }

  if (event.event === "subscription.create" || event.event === "subscription.enable") {
    await applyWebhookSubscriptionUpdate(data);
    return;
  }

  if (event.event === "invoice.payment_failed") {
    await applyWebhookFailureOrDisable(data, "past_due");
    return;
  }

  if (event.event === "subscription.disable" || event.event === "subscription.not_renew") {
    await applyWebhookFailureOrDisable(data, "cancelled");
  }
}

export async function cancelAgentSubscription(agentId: string) {
  const subscription = await getSubscriptionByAgentId(agentId);
  if (!subscription?.paystackSubscriptionCode || !subscription.paystackEmailToken) {
    throw new Error("This subscription cannot be cancelled automatically yet.");
  }

  await disablePaystackSubscription({
    code: subscription.paystackSubscriptionCode,
    token: subscription.paystackEmailToken
  });

  return updateSubscriptionBillingState(agentId, {
    status: "cancelled",
    isActive: false,
    cancelAtPeriodEnd: true
  });
}
