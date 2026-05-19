"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminIdentityCard, AdminShell, AdminStatCard } from "@/components/admin/admin-shell";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { AdminAgentReview, UserRecord } from "@/lib/types";

type AdminData = {
  agents: AdminAgentReview[];
};

type AdminAccount = {
  user: UserRecord | null;
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
      </div>
    </AdminShell>
  );
}
