import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/lib/auth";
import { getAgentDashboardData } from "@/modules/agents/agent.service";
import { getAgentListings } from "@/modules/listings/listing.service";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    requireRole(decoded, "agent");

    const [profile, listings] = await Promise.all([
      getAgentDashboardData(decoded.uid),
      getAgentListings(decoded.uid)
    ]);

    return NextResponse.json({ profile, listings });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load agent data." },
      { status: 400 }
    );
  }
}
