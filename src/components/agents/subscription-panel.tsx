"use client";

import { useEffect, useState } from "react";

import { SupportRequestForm } from "@/components/agents/support-request-form";
import { PlanFeatureRow } from "@/components/shared/plan-feature-row";
import { apiRequest } from "@/lib/api";
import {
  formatPlanPrice,
  getPlanFeatureRows,
  getPricingPlan,
  isLowerPlan,
  isPaidPricingPlanSlug,
  PRICING_PLANS
} from "@/lib/pricing";
import { getEffectivePlanSlug, isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { AgentEntitlements, BillingMode, SubscriptionRecord } from "@/lib/types";

type Props = {
  token: string;
  agent: {
    verificationStatus: string;
    isBlocked: boolean;
  };
  subscription?: SubscriptionRecord | null;
  billingLiveEnabled: boolean;
  entitlements?: AgentEntitlements;
  onSubscriptionChanged?: (subscription: SubscriptionRecord) => void;
};

function checkoutBusyKey(planSlug: string, billingMode: BillingMode) {
  return `${planSlug}:paystack:${billingMode}`;
}

function paymentMethodLabel(billingMode: BillingMode) {
  return billingMode === "prepaid" ? "Paystack Transfer / USSD" : "Paystack auto-renewal";
}

export function AgentSubscriptionPanel({
  token,
  agent,
  subscription,
  billingLiveEnabled,
  entitlements,
  onSubscriptionChanged
}: Props) {
  const [localSubscription, setLocalSubscription] = useState(subscription ?? null);
  const [billingMessage, setBillingMessage] = useState("");
  const [busyBillingPlan, setBusyBillingPlan] = useState<string | null>(null);
  const [cancellingBilling, setCancellingBilling] = useState(false);

  useEffect(() => {
    setLocalSubscription(subscription ?? null);
  }, [subscription]);

  useEffect(() => {
    const billingResult = new URLSearchParams(window.location.search).get("billing");
    if (billingResult === "success") {
      setBillingMessage("Payment confirmed. Your plan has been updated.");
    } else if (billingResult === "failed") {
      setBillingMessage("Payment verification failed. If you were charged, contact support with your payment reference.");
    }
  }, []);

  const verificationStatus = agent.verificationStatus ?? "pending";
  const isVerified = verificationStatus === "approved";
  const canUpgrade = isVerified && !agent.isBlocked;
  const currentPlan = getPricingPlan(getEffectivePlanSlug(localSubscription));
  const subscriptionActive = isSubscriptionCurrentlyActive(localSubscription);
  const hasActivePaidPlan = currentPlan.priceMonthly !== null && currentPlan.priceMonthly > 0 && subscriptionActive;
  const hasCancellablePaidPlan =
    hasActivePaidPlan &&
    localSubscription?.paymentProvider === "paystack" &&
    localSubscription.billingMode === "recurring";

  async function startCheckout(planSlug: string, billingMode: BillingMode) {
    if (!token || !isPaidPricingPlanSlug(planSlug)) {
      return;
    }

    setBusyBillingPlan(checkoutBusyKey(planSlug, billingMode));
    setBillingMessage("");

    try {
      const response = await apiRequest<{ authorizationUrl: string }>("/api/billing/checkout", {
        method: "POST",
        retries: 0,
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planSlug, provider: "paystack", billingMode })
      });
      window.open(response.authorizationUrl, "_blank", "noopener,noreferrer");
      setBusyBillingPlan(null);
    } catch (error) {
      setBillingMessage(
        error instanceof Error ? error.message : `Could not start ${paymentMethodLabel(billingMode)} checkout.`
      );
      setBusyBillingPlan(null);
    }
  }

  async function cancelSubscription() {
    if (!token) {
      return;
    }

    setCancellingBilling(true);
    setBillingMessage("");

    try {
      const response = await apiRequest<{ subscription: SubscriptionRecord }>("/api/billing/cancel", {
        method: "POST",
        retries: 0,
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocalSubscription(response.subscription);
      onSubscriptionChanged?.(response.subscription);
      setBillingMessage("Subscription renewal has been cancelled.");
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : "Could not cancel subscription.");
    } finally {
      setCancellingBilling(false);
    }
  }

  return (
    <section id="subscription" className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Subscription</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">Visibility plans</h2>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          {billingLiveEnabled
            ? "Secure checkout is handled by Paystack."
            : "Live billing is locked until final billing verification is complete."}
        </p>
      </div>
      {billingMessage ? (
        <p className="mt-3 rounded-2xl bg-slate-300/60 px-4 py-3 text-sm font-semibold text-slate-700">
          {billingMessage}
        </p>
      ) : null}
      {!canUpgrade ? (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Your agent account must be approved before you can upgrade.
        </p>
      ) : null}
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        What these features mean: hover, focus, or tap the helper icon beside each feature for a plain-language explanation
        before choosing a plan.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PRICING_PLANS.slice(0, 5).map((plan) => (
          <article
            key={plan.slug}
            className={`rounded-2xl border p-4 ${
              plan.slug === currentPlan.slug
                ? "border-blue-500 bg-blue-50"
                : plan.isPopular
                  ? "border-amber-300 bg-amber-50/80"
                  : "border-slate-300 bg-slate-300/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950">{plan.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">{formatPlanPrice(plan.priceMonthly)}</p>
              </div>
              {plan.slug === currentPlan.slug ? (
                <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white">Current</span>
              ) : plan.isPopular ? (
                <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">Popular</span>
              ) : null}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{plan.description}</p>
            <div className="mt-3 grid gap-2">
              {getPlanFeatureRows(plan).map((feature) => (
                <PlanFeatureRow key={feature.key} feature={feature} />
              ))}
            </div>
            <div className="mt-4">
              {plan.slug === currentPlan.slug ? (
                <button
                  className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled
                  type="button"
                >
                  Current
                </button>
              ) : hasActivePaidPlan && isLowerPlan(currentPlan.slug, plan.slug) ? (
                <p className="rounded-xl bg-slate-300/70 px-4 py-2.5 text-center text-xs font-bold text-slate-600">
                  Available after current plan expires
                </p>
              ) : isPaidPricingPlanSlug(plan.slug) && !canUpgrade ? (
                <p className="rounded-xl bg-slate-300/70 px-4 py-2.5 text-center text-xs font-bold text-slate-600">
                  Approval required before upgrade
                </p>
              ) : isPaidPricingPlanSlug(plan.slug) && billingLiveEnabled ? (
                <div className="grid gap-2">
                  {(() => {
                    const recurringBusyKey = checkoutBusyKey(plan.slug, "recurring");
                    const prepaidBusyKey = checkoutBusyKey(plan.slug, "prepaid");
                    const activePaystackRecurring =
                      hasActivePaidPlan &&
                      localSubscription?.paymentProvider === "paystack" &&
                      localSubscription.billingMode === "recurring";
                    const prepaidBlocked = activePaystackRecurring;

                    return (
                      <>
                        <button
                          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={busyBillingPlan !== null}
                          onClick={() => startCheckout(plan.slug, "recurring")}
                          type="button"
                        >
                          {busyBillingPlan === recurringBusyKey ? "Opening Paystack..." : "Auto-renew with Paystack"}
                        </button>
                        <button
                          className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={busyBillingPlan !== null || prepaidBlocked}
                          onClick={() => startCheckout(plan.slug, "prepaid")}
                          type="button"
                        >
                          {busyBillingPlan === prepaidBusyKey ? "Opening transfer checkout..." : "Pay by Transfer / USSD"}
                        </button>
                        <p className="text-center text-[11px] font-semibold leading-4 text-slate-500">
                          No ATM card needed. Pay by bank app transfer, USSD, or Paystack bank payment.
                        </p>
                        {prepaidBlocked ? (
                          <p className="text-center text-[11px] font-semibold text-slate-500">
                            Transfer / USSD prepaid payment is available after your Paystack auto-renew plan expires.
                          </p>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ) : isPaidPricingPlanSlug(plan.slug) ? (
                <p className="rounded-xl bg-slate-300/70 px-4 py-2.5 text-center text-xs font-bold text-slate-600">
                  Billing opens soon
                </p>
              ) : null}
              {plan.slug === currentPlan.slug && hasCancellablePaidPlan && !localSubscription?.cancelAtPeriodEnd ? (
                <button
                  className="mt-2 w-full rounded-xl border border-slate-400 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={cancellingBilling}
                  onClick={cancelSubscription}
                  type="button"
                >
                  {cancellingBilling ? "Cancelling..." : "Cancel renewal"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <SupportRequestForm entitlements={entitlements} token={token} />
    </section>
  );
}
