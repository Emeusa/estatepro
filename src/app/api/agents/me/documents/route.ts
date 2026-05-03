import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { saveAgentDocuments } from "@/modules/agents/agent.service";

export async function PATCH(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    const body = await request.json();
    await saveAgentDocuments(decoded.uid, body.verificationDocuments ?? []);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not save documents." },
      { status: 400 }
    );
  }
}
