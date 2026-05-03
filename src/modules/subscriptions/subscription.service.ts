import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toSubscriptionRecord } from "@/lib/supabase-mappers";

export async function getSubscription(agentId: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("subscriptions").select("*").eq("agent_id", agentId).single();
  return data ? toSubscriptionRecord(data) : null;
}
