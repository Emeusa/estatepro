import { createClient } from "@supabase/supabase-js";

import { getClientEnv, getServerEnv } from "@/config/env";

const clientEnv = getClientEnv();
const serverEnv = getServerEnv();

export function createServerSupabaseClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createServerSupabaseAuthClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
