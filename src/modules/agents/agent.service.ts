import {
  agentRegistrationSchema,
  clientRegistrationSchema
} from "@/modules/agents/agent.schema";
import {
  getAgentProfile,
  getUserProfile,
  listAgentUsersForAdmin,
  listAgentsForAdmin,
  registerClient,
  registerAgent,
  setAgentBlockStatus,
  setVerificationStatus,
  updateUserProfile
} from "@/modules/agents/agent.repository";
import { AdminAgentDetails, AdminAgentReview, AdminAgentSummary } from "@/lib/types";
import { getListingCountsByAgentIds, getListingsByAgentIds } from "@/modules/listings/listing.service";

export async function createAgentAccount(input: unknown) {
  return registerAgent(agentRegistrationSchema.parse(input));
}

export async function createClientAccount(input: unknown) {
  return registerClient(clientRegistrationSchema.parse(input));
}

export async function getAgentDashboardData(agentId: string) {
  return getAgentProfile(agentId);
}

export async function getUserAccount(userId: string) {
  return getUserProfile(userId);
}

export async function saveUserAccount(input: {
  userId: string;
  fullName: string;
  phone: string | null;
}) {
  return updateUserProfile(input);
}

export async function getAgentsForAdmin() {
  return listAgentsForAdmin();
}

export async function getAgentSummariesForAdmin(): Promise<AdminAgentSummary[]> {
  const agents = await listAgentsForAdmin();
  const agentIds = agents.map((agent) => agent.id);
  const [users, listingCounts] = await Promise.all([
    listAgentUsersForAdmin(agentIds),
    getListingCountsByAgentIds(agentIds)
  ]);

  return agents
    .map((agent) => {
      const user = users.find((candidate) => candidate.id === agent.id);
      if (!user) {
        return null;
      }

      return { user, agent, listingCount: listingCounts.get(agent.id) ?? 0 };
    })
    .filter((summary): summary is AdminAgentSummary => summary !== null);
}

export async function getAgentReviewsForAdmin(): Promise<AdminAgentReview[]> {
  const agents = await listAgentsForAdmin();
  const agentIds = agents.map((agent) => agent.id);
  const [users, listings] = await Promise.all([
    listAgentUsersForAdmin(agentIds),
    getListingsByAgentIds(agentIds)
  ]);

  return agents
    .map((agent) => {
      const user = users.find((candidate) => candidate.id === agent.id);
      if (!user) {
        return null;
      }

      return {
        user,
        agent,
        listings: listings.filter((listing) => listing.agentId === agent.id)
      };
    })
    .filter((review): review is AdminAgentReview => review !== null);
}

export async function getAgentReviewForAdmin(agentId: string): Promise<AdminAgentDetails | null> {
  const [{ agent, subscription }, user, listings] = await Promise.all([
    getAgentProfile(agentId),
    getUserProfile(agentId),
    getListingsByAgentIds([agentId])
  ]);

  if (!agent || !user || user.role !== "agent") {
    return null;
  }

  return {
    user,
    agent,
    listingCount: listings.length,
    subscription: subscription ?? null,
    listings
  };
}

export async function updateAgentVerification(
  agentId: string,
  verificationStatus: "approved" | "rejected"
) {
  return setVerificationStatus(agentId, verificationStatus);
}

export async function updateAgentBlockStatus(agentId: string, isBlocked: boolean) {
  return setAgentBlockStatus(agentId, isBlocked);
}
