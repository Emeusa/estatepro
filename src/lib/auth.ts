import { NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuthUser = {
  uid: string;
  id: string;
  email: string;
  role: "agent" | "client" | "admin";
};

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AuthError("Missing bearer token");
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
    throw new AuthError("Invalid authentication session.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.role) {
    throw new AuthError("Account profile was not found.", 403);
  }

  return {
    uid: user.id,
    id: user.id,
    email: user.email,
    role: profile.role
  };
}

export async function getOptionalAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  return requireAuth(request);
}

export function requireRole(decoded: AuthUser, role: "admin" | "agent") {
  if (decoded.role !== role && !(role === "agent" && decoded.role === "admin")) {
    throw new AuthError("Insufficient permissions", 403);
  }
}

export async function requireAdmin(request: NextRequest) {
  const decoded = await requireAuth(request);
  requireRole(decoded, "admin");
  return decoded;
}

export async function requireAgent(request: NextRequest) {
  const decoded = await requireAuth(request);
  requireRole(decoded, "agent");
  return decoded;
}
