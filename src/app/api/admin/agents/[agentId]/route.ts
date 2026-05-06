import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/lib/auth";
import {
  updateAgentBlockStatus,
  updateAgentVerification
} from "@/modules/agents/agent.service";
import { agentModerationSchema } from "@/modules/agents/agent.schema";
import { approvePendingListingsForAgent } from "@/modules/listings/listing.service";

type Props = {
  params: Promise<{ agentId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const decoded = await requireAuth(request);
    requireRole(decoded, "admin");

    const { agentId } = await params;
    const body = agentModerationSchema.parse(await request.json());

    if (body.verificationStatus) {
      await updateAgentVerification(agentId, body.verificationStatus);
      if (body.verificationStatus === "approved") {
        await approvePendingListingsForAgent(agentId);
      }
    }

    if (typeof body.isBlocked === "boolean") {
      await updateAgentBlockStatus(agentId, body.isBlocked);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update agent." },
      { status: 400 }
    );
  }
}
