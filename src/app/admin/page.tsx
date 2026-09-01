"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AdminIdentityCard, AdminShell, AdminStatCard } from "@/components/admin/admin-shell";
import { loadAdminDashboard } from "@/lib/admin-dashboard-client";
import { getPricingPlan } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import {
  AdminOverviewResponse,
  AdminOverviewSection,
  PaidPlanStats,
  UserRecord
} from "@/lib/types";

const emptyPaidPlanStats: PaidPlanStats = {
  totalPaidAgents: 0,
  starterAgent: 0,
  growthAgent: 0,
  proAgent: 0,
  agencyPlus: 0
};

const adminSectionLabels: Record<AdminOverviewSection, string> = {
  supportRequests: "support requests",
  paidPlanStats: "plan statistics",
  reportStats: "report statistics",
  notifications: "notifications"
};

export default function AdminPage() {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [message, setMessage] = useState("Checking admin access...");
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const loadedTokenRef = useRef<string | null>(null);

  const loadAdmin = useCallback((providedToken?: string) => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const task = (async () => {
      if (mountedRef.current) {
        setIsLoading(true);
        setMessage("Loading admin data...");
      }

      try {
        let accessToken = providedToken;
        if (!accessToken) {
          const {
            data: { session }
          } = await supabase.auth.getSession();
          accessToken = session?.access_token;
        }

        if (!accessToken) {
          if (mountedRef.current) {
            setData(null);
            setAccount(null);
            setMessage("Log in with an admin account to continue.");
          }
          return;
        }

        const result = await loadAdminDashboard(accessToken);
        if (mountedRef.current) {
          setData(result.overview);
          setAccount(result.account);
          loadedTokenRef.current = result.accessToken;
          setMessage("");
        }
      } catch (error) {
        if (mountedRef.current) {
          setMessage(error instanceof Error ? error.message : "Failed to load admin data.");
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    inFlightRef.current = task;
    void task.finally(() => {
      if (inFlightRef.current === task) {
        inFlightRef.current = null;
      }
    });
    return task;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadAdmin();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        loadedTokenRef.current = null;
        setData(null);
        setAccount(null);
        setMessage("Log in with an admin account to continue.");
        setIsLoading(false);
        return;
      }

      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
        session?.access_token &&
        session.access_token !== loadedTokenRef.current
      ) {
        void loadAdmin(session.access_token);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [loadAdmin]);

  if (!data) {
    return (
      <div className="relative left-1/2 -my-8 min-h-screen w-screen -translate-x-1/2 bg-[#d7dce4] p-4">
        <div className="rounded-3xl bg-slate-200 p-6 shadow-sm">
          <p className="text-sm text-slate-600">{message}</p>
          {!isLoading ? (
            <button className="button-secondary mt-4" type="button" onClick={() => void loadAdmin()}>
              Retry
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const adminName = account?.fullName ?? "Admin";
  const adminEmail = account?.email ?? "Admin account";
  const stats = data.stats;
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
        {message ? (
          <section className="mx-3 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 sm:mx-6 sm:flex-row sm:items-center sm:justify-between">
            <p>{message}</p>
            <button className="button-secondary shrink-0" type="button" disabled={isLoading} onClick={() => void loadAdmin()}>
              {isLoading ? "Retrying..." : "Retry"}
            </button>
          </section>
        ) : null}
        {data.degradedSections.length ? (
          <section className="mx-3 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:mx-6 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Some dashboard sections are temporarily unavailable: {data.degradedSections.map((section) => adminSectionLabels[section]).join(", ")}.
            </p>
            <button className="button-secondary shrink-0" type="button" disabled={isLoading} onClick={() => void loadAdmin()}>
              {isLoading ? "Retrying..." : "Retry"}
            </button>
          </section>
        ) : null}
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

        <section className="grid grid-cols-1 gap-3 px-3 sm:grid-cols-3 sm:px-6">
          <AdminStatCard label="Open Reports" value={data.reportStats?.openReports ?? 0} tone="amber" />
          <AdminStatCard label="High-Risk Reports" value={data.reportStats?.highRiskReports ?? 0} tone="amber" />
          <AdminStatCard label="Needs Review" value={data.reportStats?.needsReview ?? 0} tone="blue" />
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
          <div className="mb-4 rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Reports</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">Recent listing reports</h2>
              </div>
              <Link href="/admin/reports" className="text-sm font-bold text-blue-700 hover:text-blue-900">
                Open reports
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {data.reportStats?.recentReports.length ? (
                data.reportStats.recentReports.map((report) => (
                  <article key={report.id} className="rounded-2xl bg-slate-300/60 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-slate-950">{report.listingTitle ?? "Listing report"}</p>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold capitalize text-amber-700">
                        {report.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {report.agentName ?? "Unknown agent"} - {report.status}
                    </p>
                    <p className="mt-2 line-clamp-2 text-slate-600">{report.details}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-300/60 p-4 text-sm text-slate-500">
                  No recent listing reports.
                </p>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Notifications</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">Admin alerts</h2>
              </div>
              <span className="text-sm font-semibold text-slate-600">
                {(data.notifications ?? []).filter((notification) => !notification.isRead).length} unread
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {data.notifications?.length ? (
                data.notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.href ?? "/admin/reports"}
                    className={`block rounded-2xl p-4 text-sm transition hover:bg-slate-300 ${
                      notification.isRead ? "bg-slate-300/35" : "bg-slate-300/70"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-slate-950">{notification.title}</p>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold capitalize text-blue-700">
                        {notification.priority}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-slate-600">{notification.message}</p>
                  </Link>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-300/60 p-4 text-sm text-slate-500">No admin notifications.</p>
              )}
            </div>
          </div>

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
