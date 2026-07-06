import { createHmac } from "crypto";

import { getPlanAmountKobo, getPricingPlan, PaidPricingPlanSlug } from "@/lib/pricing";
import { getSiteUrl } from "@/lib/seo";

const OPAY_COUNTRY = "NG";
const OPAY_CURRENCY = "NGN";

type OpayEnvironment = "test" | "live";

type OpayResponse<T> = {
  code: string;
  message: string;
  data?: T;
};

export type OpayPaymentStatus = {
  reference?: string;
  orderNo?: string;
  status?: string;
  transactionId?: string | number;
  amount?: {
    total?: number | string;
    currency?: string;
  };
  country?: string;
};

export type OpayCallbackEvent = {
  payload?: OpayPaymentStatus;
  sha512?: string;
  signature?: string;
};

function getOpayEnv(): OpayEnvironment {
  return process.env.OPAY_ENV === "live" ? "live" : "test";
}

function getOpayBaseUrl() {
  if (process.env.OPAY_BASE_URL) {
    return process.env.OPAY_BASE_URL.replace(/\/$/, "");
  }

  return getOpayEnv() === "live"
    ? "https://cashierapi.opayweb.com"
    : "https://sandbox-cashierapi.opayweb.com";
}

function getOpayMerchantId() {
  const merchantId = process.env.OPAY_MERCHANT_ID;
  if (!merchantId) {
    throw new Error("OPay is not configured. Add OPAY_MERCHANT_ID in Vercel.");
  }
  return merchantId;
}

function getOpayPublicKey() {
  const publicKey = process.env.OPAY_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("OPay is not configured. Add OPAY_PUBLIC_KEY in Vercel.");
  }
  return publicKey;
}

function getOpayPrivateKey() {
  const privateKey = process.env.OPAY_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("OPay is not configured. Add OPAY_PRIVATE_KEY in Vercel.");
  }
  return privateKey;
}

function opayHeaders(extraHeaders?: HeadersInit) {
  return {
    Authorization: `Bearer ${getOpayPublicKey()}`,
    MerchantId: getOpayMerchantId(),
    "Content-Type": "application/json",
    ...extraHeaders
  };
}

function opaySuccessCode(code?: string) {
  return code === "00000" || code === "0000";
}

async function opayFetch<T>(path: string, init: RequestInit) {
  const response = await fetch(`${getOpayBaseUrl()}${path}`, init);
  const body = (await response.json().catch(() => null)) as OpayResponse<T> | null;

  if (!response.ok || !body || !opaySuccessCode(body.code)) {
    throw new Error(body?.message ?? "OPay request failed.");
  }

  if (!body.data) {
    throw new Error("OPay response did not include payment data.");
  }

  return body.data;
}

function getOpayReturnUrl(reference: string) {
  const url = getSiteUrl();
  url.pathname = "/api/billing/opay/verify";
  url.search = "";
  url.searchParams.set("reference", reference);
  url.hash = "";
  return url.toString();
}

function getOpayWebhookUrl() {
  const url = getSiteUrl();
  url.pathname = "/api/billing/opay/webhook";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function createOpayRequestSignature(rawBody: string) {
  return createHmac("sha512", getOpayPrivateKey()).update(rawBody).digest("hex");
}

function createOpayCallbackSignature(payload: OpayPaymentStatus) {
  const amount = payload.amount ?? {};
  const signatureBase = [
    amount.currency,
    amount.total,
    payload.country,
    payload.reference,
    payload.status,
    payload.transactionId
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("");

  if (!signatureBase) {
    return null;
  }

  return createHmac("sha3-512", getOpayPrivateKey()).update(signatureBase).digest("hex");
}

export function verifyOpayCallbackSignature(event: OpayCallbackEvent) {
  const payload = event.payload;
  const signature = event.sha512 ?? event.signature;
  if (!payload || !signature) {
    return false;
  }

  const expected = createOpayCallbackSignature(payload);
  return expected ? expected.toLowerCase() === signature.toLowerCase() : false;
}

export function isSuccessfulOpayStatus(status?: string | null) {
  if (!status) {
    return false;
  }

  return ["SUCCESS", "SUCCESSFUL", "COMPLETED"].includes(status.toUpperCase());
}

export function getOpayAmountKobo(data: OpayPaymentStatus) {
  const total = data.amount?.total;
  if (typeof total === "number") {
    return total;
  }
  if (typeof total === "string" && total.trim()) {
    return Number(total);
  }
  return NaN;
}

export function getOpayTransactionId(data: OpayPaymentStatus) {
  return data.transactionId === undefined || data.transactionId === null ? null : String(data.transactionId);
}

export async function initializeOpayPayment(input: {
  agentId: string;
  email: string;
  planSlug: PaidPricingPlanSlug;
  reference: string;
}) {
  const plan = getPricingPlan(input.planSlug);
  const amountKobo = getPlanAmountKobo(input.planSlug);

  const body = JSON.stringify({
    country: OPAY_COUNTRY,
    reference: input.reference,
    amount: {
      total: amountKobo,
      currency: OPAY_CURRENCY
    },
    returnUrl: getOpayReturnUrl(input.reference),
    callbackUrl: getOpayWebhookUrl(),
    cancelUrl: `${getSiteUrl().origin}/agents/dashboard?billing=failed#subscription`,
    expireAt: 30,
    userInfo: {
      userId: input.agentId,
      userEmail: input.email
    },
    productList: [
      {
        productId: input.planSlug,
        name: plan.name,
        description: plan.description,
        price: amountKobo,
        quantity: 1
      }
    ]
  });

  const data = await opayFetch<{
    cashierUrl?: string;
    cashier_url?: string;
    orderNo?: string;
    order_no?: string;
    reference?: string;
  }>("/api/v3/cashier/initialize", {
    method: "POST",
    headers: opayHeaders(),
    body
  });

  const authorizationUrl = data.cashierUrl ?? data.cashier_url;
  if (!authorizationUrl) {
    throw new Error("OPay did not return a checkout URL.");
  }

  return {
    authorizationUrl,
    orderNo: data.orderNo ?? data.order_no ?? null,
    reference: data.reference ?? input.reference
  };
}

export async function verifyOpayPaymentStatus(reference: string) {
  const body = JSON.stringify({
    country: OPAY_COUNTRY,
    reference
  });

  return opayFetch<OpayPaymentStatus>("/api/v3/cashier/status", {
    method: "POST",
    headers: opayHeaders({
      Signature: createOpayRequestSignature(body)
    }),
    body
  });
}
