"use client";

import { createClient } from "@supabase/supabase-js";

import { getClientEnv } from "@/config/env";

const env = getClientEnv();

export const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
