"use client";

import { ApiRequestError, apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import type { AdminOverviewResponse, UserRecord } from "@/lib/types";

type AdminAccount = {
  user: UserRecord | null;
};

export type AdminDashboardLoadResult = {
  overview: AdminOverviewResponse;
  account: UserRecord | null;
  accessToken: string;
};

async function fetchAdminDashboard(accessToken: string): Promise<AdminDashboardLoadResult> {
  const [overview, adminAccount] = await Promise.all([
    apiRequest<AdminOverviewResponse>("/api/admin/overview", {
      headers: { Authorization: `Bearer ${accessToken}` }
    }),
    apiRequest<AdminAccount>("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
  ]);

  return { overview, account: adminAccount.user, accessToken };
}

export async function loadAdminDashboard(accessToken: string): Promise<AdminDashboardLoadResult> {
  try {
    return await fetchAdminDashboard(accessToken);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error;
    }

    const { data, error: refreshError } = await supabase.auth.refreshSession();
    const freshToken = data.session?.access_token;
    if (refreshError || !freshToken) {
      throw new Error("Your session expired. Log in again to continue.");
    }

    return fetchAdminDashboard(freshToken);
  }
}
