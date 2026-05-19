import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getAgentDailyListingLimit(agentId: string) {
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from("agent_quota_overrides")
      .select("daily_listing_limit")
      .eq("agent_id", agentId)
      .maybeSingle();

    return data?.daily_listing_limit ?? 20;
  } catch {
    return 20;
  }
}
