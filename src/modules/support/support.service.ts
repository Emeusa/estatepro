import { z } from "zod";

import { getPlanRank, hasPrioritySupport, isPaidPricingPlanSlug } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEffectivePlanSlug, isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { SupportRequestRecord } from "@/lib/types";
import { getAgentProfile, getUserProfile, listAgentUsersForAdmin } from "@/modules/agents/agent.repository";

export const supportRequestSchema = z.object({
  subject: z.string().trim().min(4).max(120),
  message: z.string().trim().min(10).max(1200)
});

type SupportRequestRow = {
  id: string;
  agent_id: string;
  priority: SupportRequestRecord["priority"];
  subject: string;
  message: string;
  status: SupportRequestRecord["status"];
  created_at: string;
  updated_at: string;
};

function toSupportRequest(row: SupportRequestRow, user?: { fullName: string; email: string } | null): SupportRequestRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: user?.fullName ?? null,
    agentEmail: user?.email ?? null,
    priority: row.priority,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function priorityForPlan(planSlug: string): SupportRequestRecord["priority"] {
  if (hasPrioritySupport(planSlug)) {
    return "highest";
  }
  if (getPlanRank(planSlug) >= 2) {
    return "priority";
  }
  return "normal";
}

export async function createAgentSupportRequest(agentId: string, input: unknown) {
  const payload = supportRequestSchema.parse(input);
  const [{ agent, subscription }, user] = await Promise.all([getAgentProfile(agentId), getUserProfile(agentId)]);

  if (!agent || agent.isBlocked || agent.verificationStatus !== "approved") {
    throw new Error("Your agent account must be approved and active before opening support requests.");
  }

  const planSlug = getEffectivePlanSlug(subscription);
  if (!subscription || !isSubscriptionCurrentlyActive(subscription) || !isPaidPricingPlanSlug(planSlug)) {
    throw new Error("Support requests are available on paid plans.");
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      agent_id: agentId,
      priority: priorityForPlan(planSlug),
      subject: payload.subject,
      message: payload.message,
      status: "open"
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create support request.");
  }

  return toSupportRequest(data, user);
}

export async function listSupportRequestsForAdmin(limit = 20) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("support_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  const rows = (data ?? []) as SupportRequestRow[];
  const users = await listAgentUsersForAdmin(Array.from(new Set(rows.map((row) => row.agent_id))));
  return rows.map((row) => toSupportRequest(row, users.find((user) => user.id === row.agent_id) ?? null));
}
