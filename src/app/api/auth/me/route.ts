import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAuth } from "@/lib/auth";
import { getUserAccount, saveUserAccount } from "@/modules/agents/agent.service";
import { userProfileSchema } from "@/modules/agents/agent.schema";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    const user = await getUserAccount(decoded.uid);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load user." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    const body = await request.json();
    const payload = userProfileSchema.parse(body);
    const user = await saveUserAccount({ userId: decoded.uid, ...payload });
    return NextResponse.json({ user });
  } catch (error) {
    const message =
      error instanceof ZodError
        ? "Enter a valid name and phone number."
        : error instanceof Error
          ? error.message
          : "Could not update your profile.";

    return NextResponse.json({ message }, { status: 400 });
  }
}
