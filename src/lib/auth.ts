import { NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuthUser = {
  uid: string;
  id: string;
  email: string;
  role: "agent" | "client" | "admin";
};

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  return header.replace("Bearer ", "").trim();
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const token = readBearerToken(request);
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);

  if (error || !user?.email) {
    throw new Error("Invalid authentication session.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.role) {
    throw new Error("Account profile was not found.");
  }

  return {
    uid: user.id,
    id: user.id,
    email: user.email,
    role: profile.role
  };
}

export function requireRole(decoded: AuthUser, role: "admin" | "agent") {
  if (decoded.role !== role && !(role === "agent" && decoded.role === "admin")) {
    throw new Error("Insufficient permissions");
  }
}
