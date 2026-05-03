import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/lib/auth";
import { getAgentReviewsForAdmin } from "@/modules/agents/agent.service";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    requireRole(decoded, "admin");

    const agents = await getAgentReviewsForAdmin();

    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load admin overview." },
      { status: 400 }
    );
  }
}
