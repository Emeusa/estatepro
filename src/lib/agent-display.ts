import { sanitizeText } from "@/lib/sanitize";

export function normalizeBusinessName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = sanitizeText(value);
  return normalized.length ? normalized : null;
}

export function getAgentDisplayName(fullName: string, businessName?: string | null) {
  return normalizeBusinessName(businessName) ?? fullName;
}
