import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseVerificationDocuments } from "@/modules/agents/agent.schema";
import { saveAgentDocuments } from "@/modules/agents/agent.service";

export async function PATCH(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    if (decoded.role !== "agent") {
      throw new Error("Only agents can upload verification documents.");
    }
    const body = await request.json();
    const verificationDocuments = parseVerificationDocuments(body.verificationDocuments ?? [], decoded.uid);
    await saveAgentDocuments(decoded.uid, verificationDocuments);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not save documents." },
      { status: 400 }
    );
  }
}
