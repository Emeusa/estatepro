import { z } from "zod";

import { toNameCase } from "@/lib/format";
import { normalizePhone, sanitizeText } from "@/lib/sanitize";
import { botProtectionSchema } from "@/lib/security/bot";

const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const agentRegistrationSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(6).max(72),
  fullName: z.string().min(3).max(120).transform((value) => toNameCase(sanitizeText(value))),
  phone: z.string().min(10).max(20).transform(normalizePhone),
  ninNumber: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "NIN must be exactly 11 digits.")
}).strict();

export const clientRegistrationSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(6).max(72),
  fullName: z
    .string()
    .optional()
    .transform((value) => {
      if (!value?.trim()) {
        return "Client User";
      }
      return sanitizeText(value);
    }),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) {
        return null;
      }
      return normalizePhone(value);
    })
}).strict();

export const agentRegistrationRequestSchema = agentRegistrationSchema
  .extend(botProtectionSchema.shape)
  .strict();

export const clientRegistrationRequestSchema = clientRegistrationSchema
  .extend(botProtectionSchema.shape)
  .strict();

export const userProfileSchema = z.object({
  fullName: z.string().min(2).max(120).transform((value) => toNameCase(sanitizeText(value))),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) {
        return null;
      }
      return normalizePhone(value);
    })
}).strict();

export const agentModerationSchema = z.object({
  verificationStatus: z.enum(["approved", "rejected"]).optional(),
  isBlocked: z.boolean().optional()
}).strict();
