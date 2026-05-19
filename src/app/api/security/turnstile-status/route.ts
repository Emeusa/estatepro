import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    publicSiteKeyConfigured: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    serverSecretConfigured: Boolean(process.env.TURNSTILE_SECRET_KEY)
  });
}
