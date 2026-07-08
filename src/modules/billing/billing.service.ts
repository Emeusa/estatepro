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
import {
  getOpayAmountKobo,
  getOpayTransactionId,
  initializeOpayPayment,
  isSuccessfulOpayStatus,
  OpayCallbackEvent,
  OpayPaymentStatus,
  verifyOpayPaymentStatus
} from "@/lib/opay";
import { isBillingLiveEnabled, isOpayConfigured } from "@/lib/billing-config";
import { getEffectivePlanSlug, isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { getPlanAmountKobo, isHigherPlan, isLowerPlan, isPaidPricingPlanSlug } from "@/lib/pricing";
import { BillingProvider, SubscriptionRecord } from "@/lib/types";
import { getAgentProfile } from "@/modules/agents/agent.repository";
import {
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionFailedEmail
} from "@/modules/email/email.service";
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

function normalizeBillingProvider(provider?: string | null): BillingProvider {
  return provider === "opay" ? "opay" : "paystack";
}

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

function assertBillingLive(provider: BillingProvider) {
  if (!isBillingLiveEnabled()) {
    throw new Error("Paid billing is not live yet. Complete final billing verification before accepting payments.");
  }

  if (provider === "opay" && !isOpayConfigured()) {
    throw new Error("OPay is not configured yet. Add the OPay merchant keys in Vercel.");
  }
}

function assertPlanTransitionAllowed(input: {
  subscription?: SubscriptionRecord | null;
  targetPlanSlug: string;
  provider: BillingProvider;
}) {
  const { subscription, targetPlanSlug, provider } = input;
  if (!subscription || !isSubscriptionCurrentlyActive(subscription)) {
    return;
  }

  const currentPlanSlug = getEffectivePlanSlug(subscription);
  const hasActivePaidPlan = isPaidPricingPlanSlug(currentPlanSlug);

  if (subscription.planSlug === targetPlanSlug && subscription.isActive) {
    throw new Error("You are already on this plan.");
  }

  if (hasActivePaidPlan && isLowerPlan(currentPlanSlug, targetPlanSlug)) {
    throw new Error("Lower plans are available after your current plan expires.");
  }

  if (
    hasActivePaidPlan &&
    isHigherPlan(currentPlanSlug, targetPlanSlug) &&
    subscription.paymentProvider === "paystack" &&
    provider === "opay"
  ) {
    throw new Error("Wait until your current Paystack plan expires before switching to OPay.");
  }
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
  provider?: string;
}) {
  if (!isPaidPricingPlanSlug(input.planSlug)) {
    throw new Error("Select a paid monthly plan to continue.");
  }
  const provider = normalizeBillingProvider(input.provider);
  assertBillingLive(provider);

  const { agent, subscription } = await getAgentProfile(input.agentId);
  if (!agent) {
    throw new Error("Agent profile was not found.");
  }
  if (agent.isBlocked || agent.verificationStatus !== "approved") {
    const error = new Error("Your agent account must be approved and active before upgrading.");
    error.name = "BillingApprovalRequiredError";
    throw error;
  }
  assertPlanTransitionAllowed({ subscription, targetPlanSlug: input.planSlug, provider });

  const reference = createBillingReference();
  const paystackPlanCode = provider === "paystack" ? getPaystackPlanCode(input.planSlug) : null;
  const amountKobo = getPlanAmountKobo(input.planSlug);

  await createBillingTransaction({
    agentId: input.agentId,
    reference,
    planSlug: input.planSlug,
    paymentProvider: provider,
    paystackPlanCode,
    amountKobo
  });

  try {
    if (provider === "opay") {
      const checkout = await initializeOpayPayment({
        agentId: input.agentId,
        email: input.email,
        planSlug: input.planSlug,
        reference
      });

      await updateBillingTransactionInitialized({
        reference,
        authorizationUrl: checkout.authorizationUrl,
        accessCode: checkout.orderNo ?? checkout.reference,
        opayOrderNo: checkout.orderNo
      });

      return {
        authorizationUrl: checkout.authorizationUrl,
        reference
      };
    }

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
      message: error instanceof Error ? error.message : "Billing checkout failed.",
      provider
    });
    throw error;
  }
}

export async function applySuccessfulPaystackTransaction(reference: string) {
  const billingTransaction = await getBillingTransactionByReference(reference);
  if (!billingTransaction) {
    throw new Error("Billing transaction was not found.");
  }
  if (billingTransaction.paymentProvider !== "paystack" || !billingTransaction.paystackPlanCode) {
    throw new Error("This payment reference is not a Paystack transaction.");
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
    paymentProvider: "paystack",
    billingMode: "recurring",
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
  await sendSubscriptionActivatedEmail({
    agentId: billingTransaction.agentId,
    planSlug: billingTransaction.planSlug,
    provider: "paystack",
    reference
  });

  return subscription;
}

function assertSuccessfulOpayTransaction(
  transaction: OpayPaymentStatus,
  expected: {
    reference: string;
    amountKobo: number;
    currency: string;
  }
) {
  if (!isSuccessfulOpayStatus(transaction.status)) {
    throw new Error("OPay payment was not successful.");
  }

  if (transaction.reference && transaction.reference !== expected.reference) {
    throw new Error("OPay payment reference mismatch.");
  }

  if (getOpayAmountKobo(transaction) !== expected.amountKobo || transaction.amount?.currency !== expected.currency) {
    throw new Error("OPay payment amount mismatch.");
  }
}

export async function applySuccessfulOpayTransaction(reference: string) {
  const billingTransaction = await getBillingTransactionByReference(reference);
  if (!billingTransaction) {
    throw new Error("Billing transaction was not found.");
  }
  if (billingTransaction.paymentProvider !== "opay") {
    throw new Error("This payment reference is not an OPay transaction.");
  }

  const transaction = await verifyOpayPaymentStatus(reference);
  try {
    assertSuccessfulOpayTransaction(transaction, {
      reference,
      amountKobo: billingTransaction.amountKobo,
      currency: billingTransaction.currency
    });
  } catch (error) {
    await markBillingTransactionFailed(reference, transaction);
    throw error;
  }

  const now = new Date().toISOString();
  const opayOrderNo = transaction.orderNo ?? billingTransaction.opayOrderNo;
  const opayTransactionId = getOpayTransactionId(transaction);
  const subscription = await upsertActiveSubscription({
    agentId: billingTransaction.agentId,
    planSlug: billingTransaction.planSlug,
    paymentProvider: "opay",
    billingMode: "prepaid",
    opayOrderNo,
    opayTransactionId,
    currentPeriodStart: now,
    currentPeriodEnd: getFallbackPeriodEnd(new Date(now))
  });

  await markBillingTransactionSuccess({
    reference,
    opayOrderNo,
    opayTransactionId,
    rawResponse: transaction
  });
  await sendSubscriptionActivatedEmail({
    agentId: billingTransaction.agentId,
    planSlug: billingTransaction.planSlug,
    provider: "opay",
    reference
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
    paymentProvider: "paystack",
    billingMode: "recurring",
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
  if (status === "past_due") {
    await sendSubscriptionFailedEmail(agentId);
  } else {
    await sendSubscriptionCancelledEmail(agentId);
  }
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

export async function processOpayWebhook(event: OpayCallbackEvent) {
  const payload = event.payload ?? {};
  const reference = readString(payload.reference);
  if (!reference) {
    return;
  }

  if (!isSuccessfulOpayStatus(payload.status)) {
    const transaction = await getBillingTransactionByReference(reference);
    await markBillingTransactionFailed(reference, event);
    if (transaction) {
      await sendSubscriptionFailedEmail(transaction.agentId);
    }
    return;
  }

  await applySuccessfulOpayTransaction(reference);
}

export async function cancelAgentSubscription(agentId: string) {
  const subscription = await getSubscriptionByAgentId(agentId);
  if (subscription?.paymentProvider === "opay" || subscription?.billingMode === "prepaid") {
    throw new Error("OPay prepaid plans do not renew automatically, so there is no renewal to cancel.");
  }
  if (!subscription?.paystackSubscriptionCode || !subscription.paystackEmailToken) {
    throw new Error("This subscription cannot be cancelled automatically yet.");
  }

  await disablePaystackSubscription({
    code: subscription.paystackSubscriptionCode,
    token: subscription.paystackEmailToken
  });

  const updatedSubscription = await updateSubscriptionBillingState(agentId, {
    status: "cancelled",
    isActive: false,
    cancelAtPeriodEnd: true
  });
  await sendSubscriptionCancelledEmail(agentId);
  return updatedSubscription;
}
