import { after, NextRequest, NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/lib/auth";
import { captureServerError, logSecurityEvent } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import {
  getAgentReviewForAdmin,
  updateAgentBlockStatus,
  updateAgentVerification
} from "@/modules/agents/agent.service";
import { agentModerationSchema } from "@/modules/agents/agent.schema";
import { approvePendingListingsForAgent } from "@/modules/listings/listing.service";
import { revalidateListingMutationPaths } from "@/modules/listings/listing-cache";
import { sendAgentVerificationEmail } from "@/modules/email/email.service";

type Props = {
  params: Promise<{ agentId: string }>;
};

async function sendVerificationEmailSafely(agentId: string, status: "approved" | "rejected") {
  try {
    await sendAgentVerificationEmail(agentId, status);
  } catch (error) {
    console.error("Agent verification email failed after moderation", {
      agentId,
      status,
      error: error instanceof Error ? error.message : "unknown"
    });
  }
}

function scheduleVerificationEmail(agentId: string, status: "approved" | "rejected") {
  try {
    after(() => sendVerificationEmailSafely(agentId, status));
  } catch {
    // Tests and non-Next runtimes may not provide an after() request scope.
    void sendVerificationEmailSafely(agentId, status);
  }
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { agentId } = await params;
    const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const review = await getAgentReviewForAdmin(agentId, page);

    if (!review) {
      return withRateLimitHeaders(NextResponse.json({ message: "Agent not found." }, { status: 404 }), limited.headers);
    }

    return withRateLimitHeaders(NextResponse.json({ agent: review }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/admin/agents/[agentId]" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load agent." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { agentId } = await params;
    const body = agentModerationSchema.parse(await request.json());
    let listingActivationSummary: Awaited<ReturnType<typeof approvePendingListingsForAgent>> | null = null;

    if (body.verificationStatus) {
      await updateAgentVerification(agentId, body.verificationStatus);
      await logSecurityEvent({
        request,
        action: "agent_verification_change",
        result: "success",
        userId: decoded.uid,
        metadata: { agentId, verificationStatus: body.verificationStatus }
      });
      if (body.verificationStatus === "approved") {
        listingActivationSummary = await approvePendingListingsForAgent(agentId);
      }
      scheduleVerificationEmail(agentId, body.verificationStatus);
    }

    if (typeof body.isBlocked === "boolean") {
      await updateAgentBlockStatus(agentId, body.isBlocked);
      await logSecurityEvent({
        request,
        action: "agent_block_change",
        result: "success",
        userId: decoded.uid,
        metadata: { agentId, isBlocked: body.isBlocked }
      });
    }

    revalidateListingMutationPaths();

    return withRateLimitHeaders(
      NextResponse.json({
        ok: true,
        ...(listingActivationSummary ? { listingActivationSummary } : {})
      }),
      limited.headers
    );
  } catch (error) {
    captureServerError(error, { route: "/api/admin/agents/[agentId]" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update agent." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
