import { createHash, randomUUID } from "crypto";
import { NextRequest } from "next/server";

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    forwarded ||
    "unknown"
  );
}

export function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent")?.slice(0, 300) ?? "unknown";
}

export function getRequestId(request: NextRequest) {
  return request.headers.get("x-request-id") ?? randomUUID();
}

export function hashIp(ip: string) {
  const salt = process.env.SECURITY_LOG_SALT || "estatehub-dev-security-log-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function hashValue(value: string) {
  const salt = process.env.SECURITY_LOG_SALT || "estatehub-dev-security-log-salt";
  return createHash("sha256").update(`${salt}:${value.toLowerCase().trim()}`).digest("hex");
}
