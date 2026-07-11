"use client";

import { useEffect, useMemo, useState } from "react";

import { AnalyticsSummary } from "@/components/agents/analytics-summary";
import { AgentSubscriptionPanel } from "@/components/agents/subscription-panel";
import { EntitlementSummary } from "@/components/agents/entitlement-summary";
import { ListingManager } from "@/components/agents/listing-manager";
import { VerifiedAgentName } from "@/components/agents/verified-agent-name";
import { apiRequest } from "@/lib/api";
import { formatPlanPrice, getPricingPlan } from "@/lib/pricing";
import { getEffectivePlanSlug, isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { supabase } from "@/lib/supabase/client";
import {
  AgentAnalyticsSummary,
  AgentEntitlements,
  ListingRecord,
  SubscriptionRecord,
  UserRecord
} from "@/lib/types";

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
  entitlements?: AgentEntitlements;
  analytics?: AgentAnalyticsSummary;
  billing?: {
    liveEnabled: boolean;
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
  { label: "Saved Listings", href: "/saved-listings" },
  { label: "Subscription", href: "/agents/subscription" },
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
  const accountStatus = isBlocked ? "Blocked" : "Operational";
  const currentSubscription = data.profile.subscription ?? null;
  const currentPlan = getPricingPlan(getEffectivePlanSlug(currentSubscription));
  const subscriptionActive = isSubscriptionCurrentlyActive(currentSubscription);
  const hasActivePaidPlan = currentPlan.priceMonthly !== null && currentPlan.priceMonthly > 0 && subscriptionActive;
  const billingLiveEnabled = data.billing?.liveEnabled ?? false;
  const currentPeriodEndLabel = readableDate(currentSubscription?.currentPeriodEnd);

  function postProperty() {
    setCreateRequestKey((current) => current + 1);
  }

  function updateDashboardListings(listings: ListingRecord[]) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const activeListingCount = listings.filter(
        (listing) => listing.status === "active" && listing.availability === "available"
      ).length;
      return {
        ...current,
        listings,
        entitlements: current.entitlements
          ? {
              ...current.entitlements,
              activeListingCount
            }
          : current.entitlements
      };
    });
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

            <EntitlementSummary entitlements={data.entitlements} />
            <AnalyticsSummary analytics={data.analytics} />

            {!hasActivePaidPlan ? (
              <section className="px-3 sm:px-6">
                <AgentSubscriptionPanel
                  agent={{
                    verificationStatus,
                    isBlocked
                  }}
                  billingLiveEnabled={billingLiveEnabled}
                  entitlements={data.entitlements}
                  onSubscriptionChanged={(subscription) =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            profile: {
                              ...current.profile,
                              subscription
                            }
                          }
                        : current
                    )
                  }
                  subscription={currentSubscription}
                  token={data.token}
                />
              </section>
            ) : null}

            <div className="px-3 sm:px-6">
              <ListingManager
                token={data.token}
                initialListings={data.listings}
                entitlements={data.entitlements}
                createRequestKey={createRequestKey}
                listLimit={3}
                viewAllHref="/agents/listings"
                listTitle="Recent listings"
                enableEditQueryParam
                onEntitlementsChanged={(entitlements) =>
                  setData((current) => (current ? { ...current, entitlements } : current))
                }
                onListingsChanged={updateDashboardListings}
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
