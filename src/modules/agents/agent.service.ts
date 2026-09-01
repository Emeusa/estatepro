import {
  agentRegistrationSchema,
  clientRegistrationSchema
} from "@/modules/agents/agent.schema";
import {
  getAgentProfile,
  getUserProfile,
  countAdminAgentOverviewStats,
  listAgentUsersForAdmin,
  listAgentsForAdmin,
  countPaidPlanSubscriptionsForAdmin,
  registerClient,
  registerAgent,
  setAgentBlockStatus,
  setVerificationStatus,
  updateUserProfile
} from "@/modules/agents/agent.repository";
import { AdminAgentDetails, AdminAgentReview, AdminAgentSummary, AdminOverviewStats, PaidPlanStats } from "@/lib/types";
import {
  getActiveListingCountForAdmin,
  getAgentListingsPage,
  getListingCountsByAgentIds,
  getListingsByAgentIds
} from "@/modules/listings/listing.service";
import { sendAgentRegistrationReceivedEmail } from "@/modules/email/email.service";
import { getSubscriptionAdminGrantHistory } from "@/modules/subscriptions/admin-grant.service";

export async function createAgentAccount(input: unknown) {
  const result = await registerAgent(agentRegistrationSchema.parse(input));
  try {
    await sendAgentRegistrationReceivedEmail(result.user.id);
  } catch (error) {
    console.error("Agent registration email failed", {
      userId: result.user.id,
      error: error instanceof Error ? error.message : "unknown"
    });
  }
  return result;
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
  businessName?: string | null;
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

export async function getPaidPlanStatsForAdmin(): Promise<PaidPlanStats> {
  return countPaidPlanSubscriptionsForAdmin();
}

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const [agentStats, activeListings] = await Promise.all([
    countAdminAgentOverviewStats(),
    getActiveListingCountForAdmin()
  ]);

  return { ...agentStats, activeListings };
}

export async function getAgentReviewForAdmin(agentId: string, page = 1): Promise<AdminAgentDetails | null> {
  const [{ agent, subscription }, user, listingResult, subscriptionGrants] = await Promise.all([
    getAgentProfile(agentId),
    getUserProfile(agentId),
    getAgentListingsPage(agentId, page),
    getSubscriptionAdminGrantHistory(agentId).catch(() => [])
  ]);

  if (!agent || !user || user.role !== "agent") {
    return null;
  }

  return {
    user,
    agent,
    listingCount: listingResult.pagination.totalItems,
    subscription: subscription ?? null,
    subscriptionGrants,
    listings: listingResult.items,
    listingPagination: listingResult.pagination
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
