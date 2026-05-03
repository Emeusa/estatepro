import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  toAgentProfile,
  toSubscriptionRecord,
  toUserRecord
} from "@/lib/supabase-mappers";
import { AgentProfile } from "@/lib/types";

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

  if (value.includes("duplicate key value") || value.includes("already exists") || value.includes("user already registered")) {
    return "An account with this email already exists.";
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

async function getAdminDocumentUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.storage
    .from("verification-documents")
    .createSignedUrl(path, 60 * 30);

  return error || !data?.signedUrl ? path : data.signedUrl;
}

async function withAdminDocumentUrls(agent: AgentProfile): Promise<AgentProfile> {
  return {
    ...agent,
    verificationDocuments: await Promise.all(
      agent.verificationDocuments.map((documentPath) => getAdminDocumentUrl(documentPath))
    )
  };
}

export async function registerClient(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string | null;
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: "client"
    }
  });

  if (error || !user?.id) {
    throw new Error(error?.message ?? "Could not create account.");
  }

  const userRecord = {
    id: user.id,
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

  if (insertError || !data) {
    await rollbackAuthUser(user.id);
    throw new Error(mapSupabaseRegistrationError(insertError?.message ?? "Could not save user profile."));
  }

  return { user: toUserRecord(data) };
}

export async function registerAgent(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  verificationDocuments: string[];
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: "agent"
    }
  });

  if (error || !user?.id) {
    throw new Error(mapSupabaseRegistrationError(error?.message ?? "Could not create agent account."));
  }

  const now = new Date();
  const trialStartsAt = now.toISOString();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const userRow = {
      id: user.id,
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
      id: user.id,
      verification_status: "pending" as const,
      verification_documents: input.verificationDocuments,
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
      agent_id: user.id,
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
    await rollbackAuthUser(user.id);
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

  return toUserRecord(data);
}

export async function listAgentsForAdmin() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("agents").select("*").limit(100);
  if (error) {
    throw new Error(error.message);
  }
  return Promise.all((data ?? []).map(toAgentProfile).map(withAdminDocumentUrls));
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

export async function updateVerificationDocuments(agentId: string, verificationDocuments: string[]) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("agents")
    .update({ verification_documents: verificationDocuments })
    .eq("id", agentId);
  if (error) {
    throw new Error(error.message);
  }
}
