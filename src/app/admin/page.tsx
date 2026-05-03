"use client";

import { useEffect, useState } from "react";

import { AdminModeration } from "@/components/admin/admin-moderation";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { AdminAgentReview } from "@/lib/types";

type AdminData = {
  agents: AdminAgentReview[];
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [token, setToken] = useState("");
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
        const response = await apiRequest<AdminData>("/api/admin/overview", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (active) {
          setData(response);
          setToken(session.access_token);
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

  if (!data) {
    return <p className="text-sm text-slate-500">{message}</p>;
  }

  return <AdminModeration token={token} agents={data.agents} />;
}
