"use client";

import { useEffect, useMemo, useState } from "react";

import { ListingManager } from "@/components/agents/listing-manager";
import { VerifiedAgentName } from "@/components/agents/verified-agent-name";
import { PlanFeatureRow } from "@/components/shared/plan-feature-row";
import { apiRequest } from "@/lib/api";
import {
  formatPlanPrice,
  getPlanFeatureRows,
  getPricingPlan,
  isHigherPlan,
  isLowerPlan,
  isPaidPricingPlanSlug,
  PRICING_PLANS
} from "@/lib/pricing";
import { getEffectivePlanSlug, isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { supabase } from "@/lib/supabase/client";
import { BillingProvider, ListingRecord, SubscriptionRecord, UserRecord } from "@/lib/types";

type DashboardData = {
  user: UserRecord | null;
  profile: {
    agent?: {
      verificationStatus: string;
      trialEndsAt: string;
      isBlocked: boolean;
    };
    subscription?: SubscriptionRecord;
  };
  listings: ListingRecord[];
  billing?: {
    liveEnabled: boolean;
    opayEnabled: boolean;
  };
  token: string;
};

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: "blue" | "green" | "amber" | "red";
};

const navItems = [
  { label: "Dashboard", href: "#dashboard" },
  { label: "My Listings", href: "/agents/listings" },
  { label: "Subscription", href: "#subscription" },
  { label: "My Profile", href: "/agents/profile" }
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AG";
}

function checkoutBusyKey(planSlug: string, provider: BillingProvider) {
  return `${planSlug}:${provider}`;
}

function readableDate(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function providerLabel(provider: BillingProvider) {
  return provider === "opay" ? "OPay" : "Paystack";
}

function StatCard({ label, value, tone = "blue" }: StatCardProps) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : tone === "red"
          ? "bg-red-50 text-red-700"
          : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-xl border border-slate-300/80 bg-slate-200 p-2.5 shadow-sm sm:rounded-2xl sm:p-5">
      <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg sm:mb-5 sm:h-10 sm:w-10 sm:rounded-xl ${toneClass}`}>
        <span className="h-2 w-2 rounded-full bg-current sm:h-2.5 sm:w-2.5" />
      </div>
      <p className="text-xl font-bold leading-none text-slate-950 sm:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-slate-500 sm:mt-2 sm:text-sm">{label}</p>
    </div>
  );
}

export default function AgentDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("Loading dashboard...");
  const [billingMessage, setBillingMessage] = useState("");
  const [busyBillingPlan, setBusyBillingPlan] = useState<string | null>(null);
  const [cancellingBilling, setCancellingBilling] = useState(false);
  const [createRequestKey, setCreateRequestKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (active) {
          setMessage("Sign in first to access the dashboard.");
        }
        return;
      }

      try {
        const profile = await apiRequest<Omit<DashboardData, "token">>("/api/agents/me", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (active) {
          setData({ ...profile, token: session.access_token });
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Failed to load dashboard.");
        }
      }
    }

    loadDashboard();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadDashboard();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const billingResult = new URLSearchParams(window.location.search).get("billing");
    if (billingResult === "success") {
      setBillingMessage("Payment confirmed. Your plan has been updated.");
    } else if (billingResult === "failed") {
      setBillingMessage("Payment verification failed. If you were charged, contact support with your payment reference.");
    }
  }, []);

  const stats = useMemo(() => {
    const listings = data?.listings ?? [];
    return {
      total: listings.length,
      active: listings.filter((listing) => listing.status === "active" && listing.availability === "available").length,
      pending: listings.filter((listing) => listing.status === "pending").length,
      unavailable: listings.filter((listing) => listing.availability !== "available").length
    };
  }, [data?.listings]);

  if (!data) {
    return (
      <div className="rounded-3xl bg-slate-200 p-6 shadow-sm">
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  const agentName = data.user?.fullName ?? "Agent";
  const verificationStatus = data.profile.agent?.verificationStatus ?? "pending";
  const isVerified = verificationStatus === "approved";
  const isBlocked = data.profile.agent?.isBlocked ?? false;
  const canUpgrade = isVerified && !isBlocked;
  const accountStatus = isBlocked ? "Blocked" : "Operational";
  const currentSubscription = data.profile.subscription ?? null;
  const currentPlan = getPricingPlan(getEffectivePlanSlug(currentSubscription));
  const subscriptionActive = isSubscriptionCurrentlyActive(currentSubscription);
  const hasActivePaidPlan = currentPlan.priceMonthly !== null && currentPlan.priceMonthly > 0 && subscriptionActive;
  const hasCancellablePaidPlan =
    hasActivePaidPlan &&
    currentSubscription?.paymentProvider === "paystack" &&
    currentSubscription.billingMode === "recurring";
  const billingLiveEnabled = data.billing?.liveEnabled ?? false;
  const opayEnabled = data.billing?.opayEnabled ?? false;
  const currentPeriodEndLabel = readableDate(currentSubscription?.currentPeriodEnd);

  function postProperty() {
    setCreateRequestKey((current) => current + 1);
  }

  async function startCheckout(planSlug: string, provider: BillingProvider) {
    if (!data?.token || !isPaidPricingPlanSlug(planSlug)) {
      return;
    }

    setBusyBillingPlan(checkoutBusyKey(planSlug, provider));
    setBillingMessage("");

    try {
      const response = await apiRequest<{ authorizationUrl: string }>("/api/billing/checkout", {
        method: "POST",
        retries: 0,
        headers: { Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ planSlug, provider })
      });
      window.open(response.authorizationUrl, "_blank", "noopener,noreferrer");
      setBusyBillingPlan(null);
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : `Could not start ${providerLabel(provider)} checkout.`);
      setBusyBillingPlan(null);
    }
  }

  async function cancelSubscription() {
    if (!data?.token) {
      return;
    }

    setCancellingBilling(true);
    setBillingMessage("");

    try {
      const response = await apiRequest<{ subscription: SubscriptionRecord }>("/api/billing/cancel", {
        method: "POST",
        retries: 0,
        headers: { Authorization: `Bearer ${data.token}` }
      });
      setData((current) =>
        current
          ? {
              ...current,
              profile: {
                ...current.profile,
                subscription: response.subscription
              }
            }
          : current
      );
      setBillingMessage("Subscription renewal has been cancelled.");
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : "Could not cancel subscription.");
    } finally {
      setCancellingBilling(false);
    }
  }

  return (
    <div id="dashboard" className="relative left-1/2 -my-8 min-h-screen w-screen -translate-x-1/2 bg-[#d7dce4]">
      <div className="grid min-h-screen lg:grid-cols-[206px_1fr]">
        <aside className="hidden border-r border-slate-400/70 bg-slate-200 lg:flex lg:flex-col">
          <div className="px-4 py-5">
            <p className="text-lg font-black tracking-tight text-[#430078]">C59 Estatehub</p>
          </div>
          <nav className="flex-1 space-y-2 px-3 py-3 text-sm text-slate-600">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex rounded-xl px-3 py-3 font-medium transition hover:bg-blue-50 hover:text-blue-700"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="border-t border-slate-300 p-3">
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-300/70 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {initials(agentName)}
              </span>
              {isVerified ? (
                <VerifiedAgentName fullName="" isVerified className="[&>span:first-child]:hidden" />
              ) : null}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b border-slate-400/70 bg-slate-200 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
            <div className="space-y-3 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {initials(agentName)}
                  </span>
                  <div className="min-w-0">
                    <VerifiedAgentName
                      fullName={agentName}
                      isVerified={isVerified}
                      className="max-w-full truncate text-sm font-semibold text-slate-950"
                    />
                    <p className="truncate text-xs text-slate-500">{data.user?.email}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden items-center justify-end lg:flex">
              <button className="text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={logout}>
                Log out
              </button>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-5">
            <section className="flex flex-col gap-3 px-3 py-3 sm:px-6 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-xl font-bold leading-tight text-slate-950 sm:text-3xl">Good day, {agentName}</h1>
                <p className="mt-1 text-sm text-slate-500 sm:mt-2">Here is what is happening with your properties today.</p>
                <button
                  className="mt-3 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:mt-4 sm:w-auto"
                  onClick={postProperty}
                >
                  + Post a Property
                </button>
              </div>
              <div className="hidden items-center gap-3 rounded-2xl bg-slate-200 p-3 shadow-sm lg:flex">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {initials(agentName)}
                </span>
                <div className="min-w-0">
                  <VerifiedAgentName
                    fullName={agentName}
                    isVerified={isVerified}
                    className="max-w-full truncate text-sm font-semibold text-slate-950"
                  />
                  <p className="mt-0.5 truncate text-xs text-slate-500">{data.user?.email}</p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2 px-3 sm:gap-4 sm:px-6 xl:grid-cols-4">
              <StatCard label="Total Listings" value={stats.total} />
              <StatCard label="Active Listings" value={stats.active} tone="green" />
              <StatCard label="Pending Listings" value={stats.pending} tone="amber" />
              <StatCard label="Unavailable Listings" value={stats.unavailable} tone="red" />
            </section>

            <section className="grid gap-2 px-3 sm:gap-4 sm:px-6 md:grid-cols-3">
              <div className="rounded-xl border border-slate-300/80 bg-slate-200 p-3 shadow-sm sm:rounded-3xl sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Verification</p>
                <p className="mt-2 text-lg font-semibold capitalize text-slate-950 sm:mt-3 sm:text-xl">{verificationStatus}</p>
              </div>
              <div id="subscription" className="rounded-xl border border-slate-300/80 bg-slate-200 p-3 shadow-sm sm:rounded-3xl sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Subscription</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 sm:mt-3 sm:text-xl">{currentPlan.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{formatPlanPrice(currentPlan.priceMonthly)}</p>
                {hasActivePaidPlan && currentSubscription?.billingMode === "prepaid" && currentPeriodEndLabel ? (
                  <p className="mt-1 text-xs font-bold text-emerald-700">Active until {currentPeriodEndLabel}</p>
                ) : null}
                {currentSubscription?.cancelAtPeriodEnd ? (
                  <p className="mt-1 text-xs font-bold text-amber-700">Renewal cancelled</p>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-300/80 bg-slate-200 p-3 shadow-sm sm:rounded-3xl sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Account Status</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 sm:mt-3 sm:text-xl">{accountStatus}</p>
              </div>
            </section>

            <section className="px-3 sm:px-6">
              <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Launch pricing</p>
                    <h2 className="mt-2 text-lg font-bold text-slate-950">Visibility plans</h2>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    {billingLiveEnabled
                      ? opayEnabled
                        ? "Secure checkout is handled by Paystack and OPay."
                        : "Paystack checkout is live. OPay appears after merchant keys are configured."
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
                  What these features mean: hover, focus, or tap the helper icon beside each feature for a plain-language
                  explanation before choosing a plan.
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
                            {(["paystack", "opay"] as BillingProvider[]).map((provider) => {
                              const busyKey = checkoutBusyKey(plan.slug, provider);
                              const opayUnavailable = provider === "opay" && !opayEnabled;
                              const paystackToOpayBlocked =
                                provider === "opay" &&
                                hasActivePaidPlan &&
                                currentSubscription?.paymentProvider === "paystack" &&
                                currentSubscription.billingMode === "recurring" &&
                                isHigherPlan(currentPlan.slug, plan.slug);
                              const disabled = busyBillingPlan !== null || opayUnavailable || paystackToOpayBlocked;

                              return (
                                <button
                                  key={provider}
                                  className={`w-full rounded-xl px-4 py-2.5 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    provider === "opay"
                                      ? "bg-emerald-600 hover:bg-emerald-700"
                                      : "bg-blue-600 hover:bg-blue-700"
                                  }`}
                                  disabled={disabled}
                                  onClick={() => startCheckout(plan.slug, provider)}
                                  type="button"
                                >
                                  {busyBillingPlan === busyKey
                                    ? `Opening ${providerLabel(provider)}...`
                                    : `Pay with ${providerLabel(provider)}`}
                                </button>
                              );
                            })}
                            {!opayEnabled ? (
                              <p className="text-center text-[11px] font-semibold text-slate-500">
                                OPay is hidden until merchant keys are configured.
                              </p>
                            ) : currentSubscription?.paymentProvider === "paystack" &&
                              currentSubscription.billingMode === "recurring" &&
                              hasActivePaidPlan &&
                              isHigherPlan(currentPlan.slug, plan.slug) ? (
                              <p className="text-center text-[11px] font-semibold text-slate-500">
                                OPay switching is available after the current Paystack period expires.
                              </p>
                            ) : null}
                          </div>
                        ) : isPaidPricingPlanSlug(plan.slug) ? (
                          <p className="rounded-xl bg-slate-300/70 px-4 py-2.5 text-center text-xs font-bold text-slate-600">
                            Billing opens soon
                          </p>
                        ) : null}
                        {plan.slug === currentPlan.slug && hasCancellablePaidPlan && !currentSubscription?.cancelAtPeriodEnd ? (
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
              </div>
            </section>

            <div className="px-3 sm:px-6">
              <ListingManager
                token={data.token}
                initialListings={data.listings}
                createRequestKey={createRequestKey}
                listLimit={3}
                viewAllHref="/agents/listings"
                listTitle="Recent listings"
                enableEditQueryParam
              />
            </div>

            <section className="px-3 pb-6 lg:hidden">
              <button
                className="w-full rounded-xl bg-slate-300 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-400/70 hover:text-slate-950"
                onClick={logout}
              >
                Log out
              </button>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
