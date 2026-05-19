import { NextRequest, NextResponse } from "next/server";

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

type Props = {
  params: Promise<{ agentId: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }

    const { agentId } = await params;
    const review = await getAgentReviewForAdmin(agentId);

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
        await approvePendingListingsForAgent(agentId);
      }
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

    return withRateLimitHeaders(NextResponse.json({ ok: true }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/admin/agents/[agentId]" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update agent." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
