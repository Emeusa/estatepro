"use client";

import { useEffect, useState } from "react";

import { ListingManager } from "@/components/agents/listing-manager";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { ListingRecord } from "@/lib/types";

type DashboardData = {
  profile: {
    agent?: {
      verificationStatus: string;
      trialEndsAt: string;
      isBlocked: boolean;
    };
    subscription?: {
      isActive: boolean;
      trialEndsAt: string;
    };
  };
  listings: ListingRecord[];
  token: string;
};

export default function AgentDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("Loading dashboard...");

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

  if (!data) {
    return <p className="text-sm text-slate-500">{message}</p>;
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Verification</p>
          <p className="mt-2 text-xl font-semibold capitalize">{data.profile.agent?.verificationStatus}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Trial ends</p>
          <p className="mt-2 text-xl font-semibold">{data.profile.subscription?.trialEndsAt.slice(0, 10)}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Account status</p>
          <p className="mt-2 text-xl font-semibold">
            {data.profile.agent?.isBlocked ? "Blocked" : "Operational"}
          </p>
          <button className="button-secondary mt-4" onClick={logout}>
            Log out
          </button>
        </div>
      </section>
      <ListingManager token={data.token} initialListings={data.listings} />
    </div>
  );
}
