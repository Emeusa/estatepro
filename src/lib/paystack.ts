import { createHmac, randomUUID } from "crypto";

import {
  getPlanAmountKobo,
  getPricingPlan,
  isPaidPricingPlanSlug,
  PaidPricingPlanSlug,
  PricingPlanSlug
} from "@/lib/pricing";
import { getSiteUrl } from "@/lib/seo";
import { PaystackCheckoutChannel } from "@/lib/types";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
export const PAYSTACK_PREPAID_CHANNELS: PaystackCheckoutChannel[] = ["bank_transfer", "ussd", "bank"];

const PLAN_ENV_KEYS: Record<PaidPricingPlanSlug, string> = {
  starter_agent: "PAYSTACK_PLAN_STARTER_AGENT",
  growth_agent: "PAYSTACK_PLAN_GROWTH_AGENT",
  pro_agent: "PAYSTACK_PLAN_PRO_AGENT",
  agency_plus: "PAYSTACK_PLAN_AGENCY_PLUS"
};

export type BillingMetadata = {
  agentId: string;
  planSlug: PaidPricingPlanSlug;
  reference: string;
  kind: "agent_subscription";
};

export type PaystackTransactionData = {
  id?: number | string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  authorization_url?: string;
  access_code?: string;
  customer?: {
    email?: string;
    customer_code?: string;
  };
  subscription?: {
    subscription_code?: string;
    email_token?: string;
  };
  plan?: string | null;
  plan_object?: {
    plan_code?: string;
  };
  metadata?: unknown;
};

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

function getPaystackSecretKey() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error("Paystack is not configured. Add PAYSTACK_SECRET_KEY in Vercel.");
  }
  return secret;
}

export function getPaystackPlanCode(planSlug: PricingPlanSlug | string) {
  if (!isPaidPricingPlanSlug(planSlug)) {
    throw new Error("Select a paid monthly plan to continue.");
  }

  const envKey = PLAN_ENV_KEYS[planSlug];
  const code = process.env[envKey];
  if (!code) {
    throw new Error(`Paystack plan is not configured. Add ${envKey} in Vercel.`);
  }
  return code;
}

export function getPlanSlugForPaystackCode(planCode?: string | null) {
  if (!planCode) {
    return null;
  }

  for (const planSlug of Object.keys(PLAN_ENV_KEYS) as PaidPricingPlanSlug[]) {
    if (process.env[PLAN_ENV_KEYS[planSlug]] === planCode) {
      return planSlug;
    }
  }

  return null;
}

export function createBillingReference() {
  return `C59-${Date.now()}-${randomUUID()}`;
}

export function getBillingCallbackUrl(reference: string) {
  const siteUrl = getSiteUrl();
  siteUrl.pathname = "/api/billing/verify";
  siteUrl.search = "";
  siteUrl.searchParams.set("reference", reference);
  siteUrl.hash = "";
  return siteUrl.toString();
}

async function paystackFetch<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const body = (await response.json().catch(() => null)) as PaystackResponse<T> | null;

  if (!response.ok || !body?.status) {
    throw new Error(body?.message ?? "Paystack request failed.");
  }

  return body.data;
}

export async function initializePaystackTransaction(input: {
  email: string;
  planSlug: PaidPricingPlanSlug;
  reference: string;
  metadata: BillingMetadata;
  mode?: "recurring" | "prepaid";
  channels?: PaystackCheckoutChannel[];
}) {
  const plan = getPricingPlan(input.planSlug);
  const amount = getPlanAmountKobo(input.planSlug);
  const mode = input.mode ?? "recurring";

  return paystackFetch<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount,
      currency: "NGN",
      ...(mode === "recurring" ? { plan: getPaystackPlanCode(input.planSlug) } : {}),
      ...(mode === "prepaid" ? { channels: input.channels ?? PAYSTACK_PREPAID_CHANNELS } : {}),
      reference: input.reference,
      callback_url: getBillingCallbackUrl(input.reference),
      metadata: JSON.stringify({
        ...input.metadata,
        planName: plan.name,
        billingMode: mode
      })
    })
  });
}

export async function verifyPaystackTransaction(reference: string) {
  return paystackFetch<PaystackTransactionData>(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET"
  });
}

export async function disablePaystackSubscription(input: { code: string; token: string }) {
  return paystackFetch<{ status?: boolean }>("/subscription/disable", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function verifyPaystackWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) {
    return false;
  }

  const hash = createHmac("sha512", getPaystackSecretKey()).update(rawBody).digest("hex");
  return hash === signature;
}

export function parsePaystackMetadata(value: unknown): Partial<BillingMetadata> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Partial<BillingMetadata>;
    } catch {
      return {};
    }
  }

  if (typeof value === "object") {
    return value as Partial<BillingMetadata>;
  }

  return {};
}

export function getPaystackPlanCodeFromTransaction(transaction: PaystackTransactionData) {
  return transaction.plan_object?.plan_code ?? (typeof transaction.plan === "string" ? transaction.plan : null);
}

export function getFallbackPeriodEnd(start = new Date()) {
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return end.toISOString();
}
