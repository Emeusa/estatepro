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
  updateUserProfile,
  updateVerificationDocuments
} from "@/modules/agents/agent.repository";
import { AdminAgentReview } from "@/lib/types";
import { getListingsByAgentIds } from "@/modules/listings/listing.service";

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

export async function updateAgentVerification(
  agentId: string,
  verificationStatus: "approved" | "rejected"
) {
  return setVerificationStatus(agentId, verificationStatus);
}

export async function updateAgentBlockStatus(agentId: string, isBlocked: boolean) {
  return setAgentBlockStatus(agentId, isBlocked);
}

export async function saveAgentDocuments(agentId: string, verificationDocuments: string[]) {
  return updateVerificationDocuments(agentId, verificationDocuments);
}
