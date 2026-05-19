import { NextRequest } from "next/server";
import { z } from "zod";

import { logSecurityEvent } from "@/lib/security/logger";
import { verifyTurnstile } from "@/lib/security/turnstile";

export const botProtectionSchema = z.object({
  website: z.string().max(0).optional().default(""),
  formStartedAt: z.coerce.number().int().positive().optional(),
  turnstileToken: z.string().optional()
});

export type BotProtectionPayload = z.infer<typeof botProtectionSchema>;

export async function assertBotProtection(
  request: NextRequest,
  payload: BotProtectionPayload,
  action: string,
  userId?: string | null
) {
  if (payload.website) {
    await logSecurityEvent({
      request,
      action,
      result: "blocked",
      userId,
      metadata: { reason: "honeypot" }
    });
    throw new Error("Request blocked. Please refresh and try again.");
  }

  const minimumMs = 2500;
  if (payload.formStartedAt && Date.now() - payload.formStartedAt < minimumMs) {
    await logSecurityEvent({
      request,
      action,
      result: "blocked",
      userId,
      metadata: { reason: "too_fast" }
    });
    throw new Error("Please wait a moment before submitting the form.");
  }

  const turnstile = await verifyTurnstile(request, payload.turnstileToken);
  if (!turnstile.success) {
    await logSecurityEvent({
      request,
      action,
      result: "blocked",
      userId,
      metadata: { reason: "turnstile" }
    });
    throw new Error(turnstile.message);
  }
}
