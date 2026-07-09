import { NextRequest, NextResponse } from "next/server";

function getAllowedOrigins(request: NextRequest) {
  const configured = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const requestOrigin = request.nextUrl.origin;
  const developmentOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ];

  return new Set([
    requestOrigin,
    ...(siteUrl ? [siteUrl] : []),
    ...configured,
    ...(process.env.NODE_ENV === "development" ? developmentOrigins : [])
  ]);
}

function applySecurityHeaders(response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const connectSources = ["'self'", supabaseUrl].filter(Boolean).join(" ");
  const imageSources = ["'self'", "data:", "blob:", supabaseUrl].filter(Boolean).join(" ");
  const scriptSources =
    process.env.NODE_ENV === "development"
      ? "'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
      : "'self' 'unsafe-inline' https://challenges.cloudflare.com";

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src ${scriptSources}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imageSources}`,
      `connect-src ${connectSources} https://challenges.cloudflare.com`,
      "font-src 'self' data:",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return response;
}

function isUnsafeApiMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && isUnsafeApiMethod(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && !getAllowedOrigins(request).has(origin)) {
      return applySecurityHeaders(
        NextResponse.json({ message: "Origin is not allowed." }, { status: 403 })
      );
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.png).*)"]
};
