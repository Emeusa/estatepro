import { getPricingPlan, isPaidPricingPlanSlug } from "@/lib/pricing";
import { isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { SubscriptionAdminGrantRecord, SubscriptionRecord } from "@/lib/types";
import { captureServerError } from "@/lib/security/logger";
import { getAgentProfile, getUserProfile } from "@/modules/agents/agent.repository";
import { syncAgentPlanCredits } from "@/modules/entitlements/entitlement.service";
import { revalidateListingMutationPaths } from "@/modules/listings/listing-cache";
import { reconcileAgentListingsForPlan } from "@/modules/listings/listing-plan-reconciliation.service";
import {
  insertSubscriptionAdminGrant,
  listSubscriptionAdminGrantsForAgent,
  upsertManualSubscription
} from "@/modules/subscriptions/admin-grant.repository";
import {
  AdminGrantPlanSlug,
  AdminSubscriptionGrantInput,
  adminSubscriptionGrantSchema
} from "@/modules/subscriptions/admin-grant.schema";

const MAX_PROMO_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

export class AdminSubscriptionGrantError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function parseGrantPeriod(planSlug: AdminGrantPlanSlug, expiresAt?: string) {
  const periodStart = new Date();
  if (planSlug === "free_starter") {
    if (expiresAt) {
      throw new AdminSubscriptionGrantError("Free Starter does not use an expiry date.");
    }
    return {
      periodStart: periodStart.toISOString(),
      periodEnd: null
    };
  }

  if (!expiresAt) {
    throw new AdminSubscriptionGrantError("Choose an expiry date for this promo plan.");
  }

  const periodEnd = new Date(expiresAt);
  if (!Number.isFinite(periodEnd.getTime()) || periodEnd.getTime() <= periodStart.getTime()) {
    throw new AdminSubscriptionGrantError("Promo expiry must be a future date.");
  }

  if (periodEnd.getTime() - periodStart.getTime() > MAX_PROMO_DAYS * DAY_MS) {
    throw new AdminSubscriptionGrantError(`Promo grants cannot exceed ${MAX_PROMO_DAYS} days.`);
  }

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString()
  };
}

function assertCanReplaceSubscription(subscription?: SubscriptionRecord | null) {
  if (
    subscription &&
    isSubscriptionCurrentlyActive(subscription) &&
    subscription.paymentProvider === "paystack" &&
    subscription.billingMode === "recurring" &&
    isPaidPricingPlanSlug(subscription.planSlug)
  ) {
    throw new AdminSubscriptionGrantError(
      "Cancel or wait for the active paid subscription before applying a manual promo grant.",
      409
    );
  }
}

export async function grantAdminSubscription(input: {
  agentId: string;
  adminId: string;
  payload: unknown;
}): Promise<{ subscription: SubscriptionRecord; grant: SubscriptionAdminGrantRecord }> {
  const payload: AdminSubscriptionGrantInput = adminSubscriptionGrantSchema.parse(input.payload);
  const plan = getPricingPlan(payload.planSlug);
  if (plan.slug !== payload.planSlug) {
    throw new AdminSubscriptionGrantError("Choose a valid grantable plan.");
  }

  const [{ agent, subscription }, user] = await Promise.all([
    getAgentProfile(input.agentId),
    getUserProfile(input.agentId)
  ]);

  if (!agent || !user || user.role !== "agent") {
    throw new AdminSubscriptionGrantError("Agent not found.", 404);
  }

  assertCanReplaceSubscription(subscription);
  const { periodStart, periodEnd } = parseGrantPeriod(payload.planSlug, payload.expiresAt);
  const nextSubscription = await upsertManualSubscription({
    agentId: input.agentId,
    planSlug: payload.planSlug,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd
  });

  const grant = await insertSubscriptionAdminGrant({
    agentId: input.agentId,
    adminId: input.adminId,
    planSlug: payload.planSlug,
    periodStart,
    periodEnd,
    reason: payload.reason,
    previousSubscription: subscription ?? null
  });

  if (isPaidPricingPlanSlug(payload.planSlug)) {
    await syncAgentPlanCredits(input.agentId, nextSubscription);
  }
  try {
    await reconcileAgentListingsForPlan(input.agentId, nextSubscription);
  } catch (error) {
    captureServerError(error, {
      service: "admin_subscription_grant",
      operation: "listing_plan_reconciliation",
      agentId: input.agentId,
      planSlug: nextSubscription.planSlug
    });
  }
  revalidateListingMutationPaths();

  return { subscription: nextSubscription, grant };
}

export async function getSubscriptionAdminGrantHistory(agentId: string) {
  return listSubscriptionAdminGrantsForAgent(agentId);
}
