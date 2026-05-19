"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdminIdentityCard, AdminShell, statusPillClass } from "@/components/admin/admin-shell";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { AdminAgentSummary, UserRecord } from "@/lib/types";

type AdminAgentsData = {
  agents: AdminAgentSummary[];
};

type AdminAccount = {
  user: UserRecord | null;
};

type AgentFilter = "all" | "approved" | "unapproved";

const filterLabels: Record<AgentFilter, string> = {
  all: "All",
  approved: "Approved",
  unapproved: "Unapproved"
};

function isApprovedAgent(summary: AdminAgentSummary) {
  return summary.agent.verificationStatus === "approved" && !summary.agent.isBlocked;
}

function isUnapprovedAgent(summary: AdminAgentSummary) {
  return summary.agent.verificationStatus !== "approved" || summary.agent.isBlocked;
}

function verificationTone(summary: AdminAgentSummary) {
  if (summary.agent.isBlocked) {
    return "red";
  }
  if (summary.agent.verificationStatus === "approved") {
    return "green";
  }
  if (summary.agent.verificationStatus === "rejected") {
    return "red";
  }
  return "amber";
}

export default function AdminAgentsPage() {
  const [data, setData] = useState<AdminAgentsData | null>(null);
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [filter, setFilter] = useState<AgentFilter>("all");
  const [message, setMessage] = useState("Checking admin access...");

  useEffect(() => {
    let active = true;

    async function loadAgents() {
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
        const [agentsData, adminAccount] = await Promise.all([
          apiRequest<AdminAgentsData>("/api/admin/agents", {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          apiRequest<AdminAccount>("/api/auth/me", {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        ]);

        if (active) {
          setData(agentsData);
          setAccount(adminAccount.user);
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Failed to load agents.");
        }
      }
    }

    loadAgents();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadAgents();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredAgents = useMemo(() => {
    const agents = data?.agents ?? [];
    if (filter === "approved") {
      return agents.filter(isApprovedAgent);
    }
    if (filter === "unapproved") {
      return agents.filter(isUnapprovedAgent);
    }
    return agents;
  }, [data?.agents, filter]);

  const counts = useMemo(() => {
    const agents = data?.agents ?? [];
    return {
      all: agents.length,
      approved: agents.filter(isApprovedAgent).length,
      unapproved: agents.filter(isUnapprovedAgent).length
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

  return (
    <AdminShell active="agents" adminName={adminName} adminEmail={adminEmail}>
      <div className="space-y-4 sm:space-y-5">
        <section className="flex flex-col gap-4 px-3 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Agents</h1>
            <p className="mt-2 text-sm text-slate-600">Review agent accounts without crowding the main dashboard.</p>
          </div>
          <AdminIdentityCard adminName={adminName} adminEmail={adminEmail} />
        </section>

        <section className="px-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(filterLabels) as AgentFilter[]).map((key) => (
              <button
                key={key}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  filter === key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
                onClick={() => setFilter(key)}
                type="button"
              >
                {filterLabels[key]} ({counts[key]})
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 px-3 pb-6 sm:px-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.length ? (
            filteredAgents.map((summary) => (
              <Link
                key={summary.agent.id}
                href={`/admin/agents/${summary.agent.id}`}
                className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-slate-950">{summary.user.fullName}</h2>
                    <p className="mt-1 truncate text-sm text-slate-500">{summary.user.email}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">{summary.user.phone ?? "No phone number"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold capitalize ${statusPillClass(verificationTone(summary))}`}>
                    {summary.agent.isBlocked ? "Blocked" : summary.agent.verificationStatus}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <span className="rounded-xl bg-slate-300/60 px-3 py-2">
                    Verification: <strong className="capitalize text-slate-800">{summary.agent.verificationStatus}</strong>
                  </span>
                  <span className="rounded-xl bg-slate-300/60 px-3 py-2">
                    Listings: <strong className="text-slate-800">{summary.listingCount}</strong>
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-200 p-6 text-sm text-slate-500 shadow-sm">
              No agents match the selected filter.
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
