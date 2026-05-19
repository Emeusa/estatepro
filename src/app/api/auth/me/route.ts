import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError, requireAuth } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getUserAccount, saveUserAccount } from "@/modules/agents/agent.service";
import { userProfileSchema } from "@/modules/agents/agent.schema";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }
    const user = await getUserAccount(decoded.uid);
    return withRateLimitHeaders(NextResponse.json({ user }), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/auth/me", method: "GET" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load user." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const decoded = await requireAuth(request);
    const limited = await rateLimit(request, RATE_LIMITS.userApi, decoded.uid, decoded.uid);
    if (!limited.allowed) {
      return limited.response;
    }
    const body = await request.json();
    const payload = userProfileSchema.parse(body);
    const user = await saveUserAccount({ userId: decoded.uid, ...payload });
    return withRateLimitHeaders(NextResponse.json({ user }), limited.headers);
  } catch (error) {
    const message =
      error instanceof ZodError
        ? "Enter a valid name and phone number."
        : error instanceof Error
          ? error.message
          : "Could not update your profile.";

    captureServerError(error, { route: "/api/auth/me", method: "PATCH" });
    return NextResponse.json(
      { message },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
