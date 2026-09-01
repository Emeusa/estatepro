import { NextRequest } from "next/server";
import { z } from "zod";

import { logSecurityEvent } from "@/lib/security/logger";
import { verifyTurnstile } from "@/lib/security/turnstile";

export const botProtectionSchema = z.object({
  website: z.string().max(0).optional().default(""),
  formStartedAt: z.coerce.number().int().positive().optional(),
  turnstileToken: z.string().optional(),
  turnstileStatus: z.string().max(20).optional()
});

export type BotProtectionPayload = z.infer<typeof botProtectionSchema>;

export class BotProtectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BotProtectionError";
  }
}

export function isBotProtectionError(error: unknown): error is BotProtectionError {
  return error instanceof BotProtectionError;
}

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
    throw new BotProtectionError("Request blocked. Please refresh and try again.");
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
    throw new BotProtectionError("Please wait a moment before submitting the form.");
  }

  const turnstile = await verifyTurnstile(request, payload.turnstileToken);
  if (!turnstile.success) {
    await logSecurityEvent({
      request,
      action,
      result: "blocked",
      userId,
      metadata: { reason: "turnstile", category: turnstile.category }
    });
    throw new BotProtectionError(turnstile.message);
  }
}
