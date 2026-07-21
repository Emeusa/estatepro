import { getSiteUrl } from "@/lib/seo";
import { createServerSupabaseAuthClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  toAgentProfile,
  toSubscriptionRecord,
  toUserRecord
} from "@/lib/supabase-mappers";
import { AgentProfile, PaidPlanStats } from "@/lib/types";

const PAID_PLAN_STAT_FIELDS: Record<string, keyof Omit<PaidPlanStats, "totalPaidAgents">> = {
  starter_agent: "starterAgent",
  growth_agent: "growthAgent",
  pro_agent: "proAgent",
  agency_plus: "agencyPlus"
};

const DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists. Please log in or reset your password.";

export class RegistrationConflictError extends Error {
  status = 409;
}

function mapSupabaseRegistrationError(message: string) {
  const value = message.toLowerCase();

  if (value.includes('relation "public.agents" does not exist') || value.includes('relation "agents" does not exist')) {
    return "agents table is missing or not initialized";
  }

  if (
    value.includes('relation "public.subscriptions" does not exist') ||
    value.includes('relation "subscriptions" does not exist')
  ) {
    return "subscriptions table is missing or not initialized";
  }

  if (value.includes('relation "public.users" does not exist') || value.includes('relation "users" does not exist')) {
    return "users table is missing or not initialized";
  }

  if (value.includes("cac_number") && value.includes("does not exist")) {
    return "Supabase setup is incomplete: CAC verification column is missing or not initialized.";
  }

  if (value.includes("nin")) {
    return "An agent with this NIN already exists.";
  }

  if (value.includes("cac")) {
    return "An agent with this CAC registration number already exists.";
  }

  if (value.includes("duplicate key value") || value.includes("already exists") || value.includes("user already registered")) {
    return DUPLICATE_EMAIL_MESSAGE;
  }

  if (value.includes("violates foreign key constraint")) {
    return "Agent profile could not be linked to the account. Please try again.";
  }

  if (value.includes("violates not-null constraint") || value.includes("violates check constraint")) {
    return "Agent profile could not be created because some required setup is missing.";
  }

  return message;
}

async function rollbackAuthUser(userId: string) {
  const supabase = createServerSupabaseClient();
  await supabase.auth.admin.deleteUser(userId);
}

async function assertEmailAvailable(email: string) {
  const supabase = createServerSupabaseClient();
  const normalizedEmail = email.toLowerCase();
  const { data: appUser, error: appUserError } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (appUserError) {
    throw new Error(mapSupabaseRegistrationError(appUserError.message));
  }

  if (appUser) {
    throw new RegistrationConflictError(DUPLICATE_EMAIL_MESSAGE);
  }

  const { data: authEmailExists, error: authEmailError } = await supabase.rpc("auth_email_exists", {
    check_email: normalizedEmail
  });

  if (authEmailError) {
    throw new Error("Supabase setup is incomplete: auth email availability helper is missing or not initialized.");
  }

  if (authEmailExists) {
    throw new RegistrationConflictError(DUPLICATE_EMAIL_MESSAGE);
  }
}

async function assertNinAvailable(ninNumber: string) {
  const supabase = createServerSupabaseClient();
  const { data: existingAgent, error } = await supabase
    .from("agents")
    .select("id")
    .eq("nin_number", ninNumber)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseRegistrationError(error.message));
  }

  if (existingAgent) {
    throw new RegistrationConflictError("An agent with this NIN already exists.");
  }
}

async function assertCacAvailable(cacNumber: string) {
  const supabase = createServerSupabaseClient();
  const { data: existingAgent, error } = await supabase
    .from("agents")
    .select("id")
    .eq("cac_number", cacNumber)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseRegistrationError(error.message));
  }

  if (existingAgent) {
    throw new RegistrationConflictError("An agent with this CAC registration number already exists.");
  }
}

async function assertRegistrationAvailable(input: { email: string; ninNumber?: string | null; cacNumber?: string | null }) {
  await assertEmailAvailable(input.email);
  if (input.ninNumber) {
    await assertNinAvailable(input.ninNumber);
  }
  if (input.cacNumber) {
    await assertCacAvailable(input.cacNumber);
  }
}

async function createAuthUserWithConfirmation(input: {
  email: string;
  password: string;
  fullName: string;
  role: "client" | "agent";
}) {
  const supabase = createServerSupabaseAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        role: input.role
      },
      emailRedirectTo: new URL("/login?confirmed=1", getSiteUrl()).toString()
    }
  });

  if (error || !data.user?.id) {
    throw new Error(error?.message ?? "Could not create account.");
  }

  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new RegistrationConflictError(DUPLICATE_EMAIL_MESSAGE);
  }

  return data.user.id;
}

export async function registerClient(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string | null;
}) {
  const supabase = createServerSupabaseClient();
  await assertRegistrationAvailable({ email: input.email });
  const userId = await createAuthUserWithConfirmation({
    email: input.email,
    password: input.password,
    fullName: input.fullName,
    role: "client"
  });

  const userRecord = {
    id: userId,
    email: input.email,
    full_name: input.fullName,
    phone: input.phone,
    role: "client" as const
  };

  const { data, error: insertError } = await supabase
    .from("users")
    .insert(userRecord)
    .select("*")
    .single();

  if (data && !insertError) {
    return { user: toUserRecord(data) };
  }

  const { data: repairedData, error: repairError } = await supabase
    .from("users")
    .upsert(userRecord, { onConflict: "id" })
    .select("*")
    .single();

  if (repairedData && !repairError) {
    return { user: toUserRecord(repairedData) };
  }

  await rollbackAuthUser(userId);
  throw new Error(
    mapSupabaseRegistrationError(
      repairError?.message ?? insertError?.message ?? "Could not save user profile."
    )
  );
}

export async function registerAgent(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  ninNumber: string | null;
  cacNumber: string | null;
}) {
  const supabase = createServerSupabaseClient();
  await assertRegistrationAvailable({ email: input.email, ninNumber: input.ninNumber, cacNumber: input.cacNumber });
  const userId = await createAuthUserWithConfirmation({
    email: input.email,
    password: input.password,
    fullName: input.fullName,
    role: "agent"
  });

  const now = new Date();
  const trialStartsAt = now.toISOString();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const userRow = {
      id: userId,
      email: input.email,
      full_name: input.fullName,
      phone: input.phone,
      role: "agent" as const
    };

    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert(userRow)
      .select("*")
      .single();

    if (userError || !userData) {
      throw new Error(mapSupabaseRegistrationError(userError?.message ?? "Agent base user record could not be created."));
    }

    const agentRow = {
      id: userId,
      verification_status: "pending" as const,
      nin_number: input.ninNumber,
      cac_number: input.cacNumber,
      is_blocked: false,
      trial_ends_at: trialEndsAt
    };

    const { data: agentData, error: agentError } = await supabase
      .from("agents")
      .insert(agentRow)
      .select("*")
      .single();

    if (agentError || !agentData) {
      throw new Error(mapSupabaseRegistrationError(agentError?.message ?? "agent profile could not be created"));
    }

    const subscriptionRow = {
      agent_id: userId,
      trial_starts_at: trialStartsAt,
      trial_ends_at: trialEndsAt,
      is_active: true
    };

    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from("subscriptions")
      .insert(subscriptionRow)
      .select("*")
      .single();

    if (subscriptionError || !subscriptionData) {
      throw new Error(
        mapSupabaseRegistrationError(subscriptionError?.message ?? "subscription record could not be created")
      );
    }

    return {
      user: toUserRecord(userData),
      agent: toAgentProfile(agentData),
      subscription: toSubscriptionRecord(subscriptionData)
    };
  } catch (error) {
    await rollbackAuthUser(userId);
    throw error;
  }
}

export async function getAgentProfile(agentId: string) {
  const supabase = createServerSupabaseClient();
  const [{ data: agentData }, { data: subscriptionData }] = await Promise.all([
    supabase.from("agents").select("*").eq("id", agentId).single(),
    supabase.from("subscriptions").select("*").eq("agent_id", agentId).single()
  ]);

  return {
    agent: agentData ? toAgentProfile(agentData) : undefined,
    subscription: subscriptionData ? toSubscriptionRecord(subscriptionData) : undefined
  };
}

export async function getUserProfile(userId: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("users").select("*").eq("id", userId).single();
  return data ? toUserRecord(data) : null;
}

export async function updateUserProfile(input: {
  userId: string;
  fullName: string;
  phone: string | null;
  businessName?: string | null;
}) {
  const supabase = createServerSupabaseClient();
  const { error: authError } = await supabase.auth.admin.updateUserById(input.userId, {
    user_metadata: {
      full_name: input.fullName
    }
  });

  if (authError) {
    throw new Error(authError.message);
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      full_name: input.fullName,
      phone: input.phone
    })
    .eq("id", input.userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update profile.");
  }

  let agent: AgentProfile | undefined;
  if (data.role === "agent") {
    if (input.businessName !== undefined) {
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .update({
          business_name: input.businessName
        })
        .eq("id", input.userId)
        .select("*")
        .single();

      if (agentError || !agentData) {
        throw new Error(agentError?.message ?? "Could not update agent profile.");
      }

      agent = toAgentProfile(agentData);
    } else {
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("*")
        .eq("id", input.userId)
        .single();

      if (!agentError && agentData) {
        agent = toAgentProfile(agentData);
      }
    }
  }

  return { user: toUserRecord(data), agent };
}

export async function listAgentsForAdmin() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("agents").select("*").limit(100);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map(toAgentProfile);
}

export async function listAgentUsersForAdmin(agentIds: string[]) {
  if (!agentIds.length) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .in("id", agentIds)
    .eq("role", "agent");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toUserRecord);
}

export async function countPaidPlanSubscriptionsForAdmin(): Promise<PaidPlanStats> {
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();
  const entries = await Promise.all(
    Object.entries(PAID_PLAN_STAT_FIELDS).map(async ([planSlug, statField]) => {
      const { count, error } = await supabase
        .from("subscriptions")
        .select("agent_id", { count: "exact", head: true })
        .eq("plan_slug", planSlug)
        .eq("is_active", true)
        .or("status.is.null,status.not.in.(past_due,cancelled,inactive)")
        .or(`current_period_end.is.null,current_period_end.gt.${now}`);

      if (error) {
        throw new Error(error.message);
      }

      return [statField, count ?? 0] as const;
    })
  );

  const stats: PaidPlanStats = {
    totalPaidAgents: 0,
    starterAgent: 0,
    growthAgent: 0,
    proAgent: 0,
    agencyPlus: 0
  };

  for (const [field, count] of entries) {
    stats[field] = count;
    stats.totalPaidAgents += count;
  }

  return stats;
}

export async function setAgentBlockStatus(agentId: string, isBlocked: boolean) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("agents").update({ is_blocked: isBlocked }).eq("id", agentId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function setVerificationStatus(
  agentId: string,
  verificationStatus: AgentProfile["verificationStatus"]
) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("agents")
    .update({ verification_status: verificationStatus })
    .eq("id", agentId);
  if (error) {
    throw new Error(error.message);
  }
}
