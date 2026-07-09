"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminIdentityCard, AdminShell, AdminStatCard } from "@/components/admin/admin-shell";
import { apiRequest } from "@/lib/api";
import { getPricingPlan } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import { AdminAgentReview, PaidPlanStats, SupportRequestRecord, UserRecord } from "@/lib/types";

type AdminData = {
  agents: AdminAgentReview[];
  supportRequests?: SupportRequestRecord[];
  paidPlanStats?: PaidPlanStats;
};

type AdminAccount = {
  user: UserRecord | null;
};

const emptyPaidPlanStats: PaidPlanStats = {
  totalPaidAgents: 0,
  starterAgent: 0,
  growthAgent: 0,
  proAgent: 0,
  agencyPlus: 0
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [message, setMessage] = useState("Checking admin access...");

  useEffect(() => {
    let active = true;

    async function loadAdmin() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (active) {
          setMessage("Log in with an admin account to continue.");
        }
        return;
      }

      try {
        const [overview, adminAccount] = await Promise.all([
          apiRequest<AdminData>("/api/admin/overview", {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          apiRequest<AdminAccount>("/api/auth/me", {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        ]);
        if (active) {
          setData(overview);
          setAccount(adminAccount.user);
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Failed to load admin data.");
        }
      }
    }

    loadAdmin();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadAdmin();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const stats = useMemo(() => {
    const agents = data?.agents ?? [];
    return {
      totalAgents: agents.length,
      approvedAgents: agents.filter((review) => review.agent.verificationStatus === "approved" && !review.agent.isBlocked)
        .length,
      activeListings: agents
        .flatMap((review) => review.listings)
        .filter((listing) => listing.status === "active" && listing.availability === "available").length,
      unapprovedAgents: agents.filter((review) => review.agent.verificationStatus !== "approved").length
    };
  }, [data?.agents]);

  if (!data) {
    return (
      <div className="relative left-1/2 -my-8 min-h-screen w-screen -translate-x-1/2 bg-[#d7dce4] p-4">
        <div className="rounded-3xl bg-slate-200 p-6 shadow-sm">
          <p className="text-sm text-slate-600">{message}</p>
        </div>
      </div>
    );
  }

  const adminName = account?.fullName ?? "Admin";
  const adminEmail = account?.email ?? "Admin account";
  const paidPlanStats = data.paidPlanStats ?? emptyPaidPlanStats;
  const paidPlanBreakdown = [
    { label: "Total Paid Agents", value: paidPlanStats.totalPaidAgents, tone: "blue" as const },
    { label: getPricingPlan("starter_agent").name, value: paidPlanStats.starterAgent, tone: "green" as const },
    { label: getPricingPlan("growth_agent").name, value: paidPlanStats.growthAgent, tone: "green" as const },
    { label: getPricingPlan("pro_agent").name, value: paidPlanStats.proAgent, tone: "green" as const },
    { label: getPricingPlan("agency_plus").name, value: paidPlanStats.agencyPlus, tone: "green" as const }
  ];

  return (
    <AdminShell active="dashboard" adminName={adminName} adminEmail={adminEmail}>
      <div className="space-y-4 sm:space-y-5">
        <section className="flex flex-col gap-4 px-3 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Admin dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">Monitor agents and active marketplace inventory.</p>
          </div>
          <AdminIdentityCard adminName={adminName} adminEmail={adminEmail} />
        </section>

        <section className="grid grid-cols-1 gap-3 px-3 sm:grid-cols-2 sm:gap-4 sm:px-6 xl:grid-cols-4">
          <AdminStatCard label="Total Agents" value={stats.totalAgents} />
          <AdminStatCard label="Approved Agents" value={stats.approvedAgents} tone="green" />
          <AdminStatCard label="Active Listings" value={stats.activeListings} tone="green" />
          <AdminStatCard label="Unapproved Agents" value={stats.unapprovedAgents} tone="amber" />
        </section>

        <section className="px-3 sm:px-6">
          <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Paid plan agents</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">Active subscriptions by plan</h2>
              </div>
              <p className="text-sm font-semibold text-slate-600">Excludes free, expired, and inactive plans</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {paidPlanBreakdown.map((item) => (
                <AdminStatCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
              ))}
            </div>
          </div>
        </section>

        <section id="profile" className="border-y border-slate-400/70 bg-slate-200 p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Profile</p>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-slate-500">Name</p>
              <p className="mt-1 font-semibold text-slate-950">{adminName}</p>
            </div>
            <div>
              <p className="text-slate-500">Email</p>
              <p className="mt-1 font-semibold text-slate-950">{adminEmail}</p>
            </div>
            <div>
              <p className="text-slate-500">Role</p>
              <p className="mt-1 font-semibold capitalize text-slate-950">{account?.role ?? "admin"}</p>
            </div>
          </div>
        </section>

        <section className="px-3 pb-6 sm:px-6">
          <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Support</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">Recent agent requests</h2>
              </div>
              <span className="text-sm font-semibold text-slate-600">{data.supportRequests?.length ?? 0} open/recent</span>
            </div>
            <div className="mt-4 space-y-3">
              {data.supportRequests?.length ? (
                data.supportRequests.map((request) => (
                  <article key={request.id} className="rounded-2xl bg-slate-300/60 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-slate-950">{request.subject}</p>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold capitalize text-blue-700">
                        {request.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {request.agentName ?? "Agent"} · {request.agentEmail ?? "No email"}
                    </p>
                    <p className="mt-2 line-clamp-2 text-slate-600">{request.message}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-300/60 p-4 text-sm text-slate-500">
                  No recent support requests.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
