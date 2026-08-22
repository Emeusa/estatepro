import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAgent } from "@/lib/auth";
import { isBillingLiveEnabled } from "@/lib/billing-config";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getAgentAnalytics } from "@/modules/analytics/analytics.service";
import { getAgentDashboardData, getUserAccount } from "@/modules/agents/agent.service";
import { getAgentEntitlements } from "@/modules/entitlements/entitlement.service";
import {
  getAgentListingSummary,
  getAgentListings,
  getAgentListingsPage
} from "@/modules/listings/listing.service";

function readBooleanFlag(request: NextRequest, key: string, defaultValue: boolean) {
  const value = request.nextUrl.searchParams.get(key);
  if (value === null) {
    return defaultValue;
  }

  return value !== "false" && value !== "0";
}

function readListLimit(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("listLimit");
  if (value === null) {
    return 50;
  }

  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 0) {
    return 50;
  }

  return Math.min(Math.trunc(limit), 50);
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAgent(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const listLimit = readListLimit(request);
    const requestedListPage = request.nextUrl.searchParams.get("listPage");
    const parsedListPage = Number(requestedListPage ?? "1");
    const listPage = Number.isInteger(parsedListPage) && parsedListPage > 0 ? parsedListPage : 1;
    const includeEntitlements = readBooleanFlag(request, "includeEntitlements", true);
    const includeAnalytics = readBooleanFlag(request, "includeAnalytics", true);
    const includeListingSummary = readBooleanFlag(request, "includeListingSummary", false);
    const [profile, listingResult, user, listingSummary] = await Promise.all([
      getAgentDashboardData(decoded.uid),
      requestedListPage === null
        ? getAgentListings(decoded.uid, listLimit).then((items) => ({ items, pagination: undefined }))
        : getAgentListingsPage(decoded.uid, listPage),
      getUserAccount(decoded.uid),
      includeListingSummary ? getAgentListingSummary(decoded.uid) : Promise.resolve(undefined)
    ]);
    const subscription = profile.subscription ?? null;
    const [entitlements, analytics] = await Promise.all([
      includeEntitlements ? getAgentEntitlements(decoded.uid, subscription) : Promise.resolve(undefined),
      includeAnalytics ? getAgentAnalytics(decoded.uid, "30d", subscription) : Promise.resolve(undefined)
    ]);

    const payload: Record<string, unknown> = {
      profile,
      listings: listingResult.items,
      user,
      billing: {
        liveEnabled: isBillingLiveEnabled()
      }
    };

    if (listingResult.pagination) {
      payload.listingPagination = listingResult.pagination;
    }

    if (includeListingSummary) {
      payload.listingSummary = listingSummary;
    }

    if (includeEntitlements) {
      payload.entitlements = entitlements;
    }

    if (includeAnalytics) {
      payload.analytics = analytics;
    }

    return withRateLimitHeaders(
      NextResponse.json(payload),
      limited.headers
    );
  } catch (error) {
    captureServerError(error, { route: "/api/agents/me" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load agent data." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
