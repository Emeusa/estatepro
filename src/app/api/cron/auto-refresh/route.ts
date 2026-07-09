import { NextRequest, NextResponse } from "next/server";

import { captureServerError } from "@/lib/security/logger";
import { refreshEligibleListings } from "@/modules/entitlements/auto-refresh.service";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

async function runCron(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    const result = await refreshEligibleListings();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    captureServerError(error, { route: "/api/cron/auto-refresh" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not refresh listings." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}
