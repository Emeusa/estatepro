"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AgentSubscriptionPanel } from "@/components/agents/subscription-panel";
import { VerifiedAgentName } from "@/components/agents/verified-agent-name";
import { apiRequest } from "@/lib/api";
import { formatPlanPrice, getPricingPlan } from "@/lib/pricing";
import { getEffectivePlanSlug, isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { supabase } from "@/lib/supabase/client";
import { AgentEntitlements, ListingRecord, SubscriptionRecord, UserRecord } from "@/lib/types";

type SubscriptionPageData = {
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
  billing?: {
    liveEnabled: boolean;
  };
  token: string;
};

const navItems = [
  { label: "Dashboard", href: "/agents/dashboard#dashboard" },
  { label: "My Listings", href: "/agents/listings" },
  { label: "Saved Listings", href: "/saved-listings" },
  { label: "Subscription", href: "/agents/subscription" },
  { label: "My Profile", href: "/agents/profile" }
];

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AG"
  );
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

export default function AgentSubscriptionPage() {
  const [data, setData] = useState<SubscriptionPageData | null>(null);
  const [message, setMessage] = useState("Loading subscription...");

  useEffect(() => {
    let active = true;

    async function loadSubscription() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (active) {
          setMessage("Sign in first to manage your subscription.");
        }
        return;
      }

      try {
        const profile = await apiRequest<Omit<SubscriptionPageData, "token">>("/api/agents/me", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (active) {
          setData({ ...profile, token: session.access_token });
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Failed to load subscription.");
        }
      }
    }

    loadSubscription();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadSubscription();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  if (!data) {
    return (
      <div className="rounded-3xl bg-slate-200 p-6 shadow-sm">
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    );
  }

  const agentName = data.user?.fullName ?? "Agent";
  const verificationStatus = data.profile.agent?.verificationStatus ?? "pending";
  const isVerified = verificationStatus === "approved";
  const isBlocked = data.profile.agent?.isBlocked ?? false;
  const currentSubscription = data.profile.subscription ?? null;
  const currentPlan = getPricingPlan(getEffectivePlanSlug(currentSubscription));
  const subscriptionActive = isSubscriptionCurrentlyActive(currentSubscription);
  const currentPeriodEndLabel = readableDate(currentSubscription?.currentPeriodEnd);

  return (
    <div className="relative left-1/2 -my-8 min-h-screen w-screen -translate-x-1/2 bg-[#d7dce4]">
      <div className="grid min-h-screen lg:grid-cols-[206px_1fr]">
        <aside className="hidden border-r border-slate-400/70 bg-slate-200 lg:flex lg:flex-col">
          <div className="px-4 py-5">
            <p className="text-lg font-black tracking-tight text-[#430078]">C59 Estatehub</p>
          </div>
          <nav className="flex-1 space-y-2 px-3 py-3 text-sm text-slate-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex rounded-xl px-3 py-3 font-medium transition ${
                  item.href === "/agents/subscription" ? "bg-blue-50 text-blue-700" : "hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {item.label}
              </Link>
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
            <div className="hidden items-center justify-end lg:flex">
              <button className="text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={logout}>
                Log out
              </button>
            </div>
          </div>

          <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-5">
            <section>
              <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Subscription</h1>
              <p className="mt-2 text-sm text-slate-500">Manage your visibility plan, payment option, and support access.</p>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-300/80 bg-slate-200 p-3 shadow-sm sm:rounded-3xl sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current Plan</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 sm:mt-3 sm:text-xl">{currentPlan.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{formatPlanPrice(currentPlan.priceMonthly)}</p>
              </div>
              <div className="rounded-xl border border-slate-300/80 bg-slate-200 p-3 shadow-sm sm:rounded-3xl sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Billing Status</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 sm:mt-3 sm:text-xl">
                  {subscriptionActive ? "Active" : "Free / inactive"}
                </p>
                {currentPeriodEndLabel ? (
                  <p className="mt-1 text-xs font-bold text-emerald-700">Until {currentPeriodEndLabel}</p>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-300/80 bg-slate-200 p-3 shadow-sm sm:rounded-3xl sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Account Eligibility</p>
                <p className="mt-2 text-lg font-semibold capitalize text-slate-950 sm:mt-3 sm:text-xl">
                  {isBlocked ? "Blocked" : verificationStatus}
                </p>
              </div>
            </section>

            <AgentSubscriptionPanel
              agent={{
                verificationStatus,
                isBlocked
              }}
              billingLiveEnabled={data.billing?.liveEnabled ?? false}
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

            <section className="pb-2 lg:hidden">
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
