import { z } from "zod";

import { normalizeBusinessName } from "@/lib/agent-display";
import { toNameCase } from "@/lib/format";
import { normalizePhone, sanitizeText } from "@/lib/sanitize";
import { botProtectionSchema } from "@/lib/security/bot";

const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

const optionalPhoneSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === "string" && !value.trim()) {
      return null;
    }
    return value;
  }, z.union([z.null(), z.string().trim().min(10).max(20).regex(/^[+\d\s().-]+$/)]))
  .transform((value) => {
    if (value === null) {
      return null;
    }
    return normalizePhone(value);
  });

const optionalBusinessNameSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === "string" && !value.trim()) {
      return null;
    }
    return value;
  }, z.union([z.null(), z.string().trim().min(2).max(120)]))
  .transform((value) => (value === null ? null : normalizeBusinessName(value)));

const optionalNinNumberSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === "string" && !value.trim()) {
      return null;
    }
    return value;
  }, z.union([z.null(), z.string().trim().regex(/^\d{11}$/, "NIN must be exactly 11 digits.")]));

export function normalizeCacNumber(value: string) {
  return sanitizeText(value).toUpperCase().replace(/\s+/g, "");
}

const optionalCacNumberSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === "string" && !value.trim()) {
      return null;
    }
    return value;
  }, z.union([z.null(), z.string().trim().min(2).max(40)]))
  .transform((value) => (value === null ? null : normalizeCacNumber(value)))
  .refine((value) => value === null || /^[A-Z0-9][A-Z0-9-]{1,29}$/.test(value), {
    message: "CAC registration number must use letters, numbers, or hyphens only."
  });

const agentRegistrationBaseSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(6).max(72),
  fullName: z.string().min(3).max(120).transform((value) => toNameCase(sanitizeText(value))),
  phone: z.string().min(10).max(20).transform(normalizePhone),
  ninNumber: optionalNinNumberSchema,
  cacNumber: optionalCacNumberSchema
}).strict();

export const agentRegistrationSchema = agentRegistrationBaseSchema;

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
  phone: optionalPhoneSchema
}).strict();

export const agentRegistrationRequestSchema = agentRegistrationBaseSchema
  .extend({
    ...botProtectionSchema.shape,
    acceptedLegalTerms: z.literal(true)
  })
  .strict();

export const clientRegistrationRequestSchema = clientRegistrationSchema
  .extend(botProtectionSchema.shape)
  .strict();

export const userProfileSchema = z.object({
  fullName: z.string().min(2).max(120).transform((value) => toNameCase(sanitizeText(value))),
  phone: optionalPhoneSchema,
  businessName: optionalBusinessNameSchema.optional()
}).strict();

export const agentModerationSchema = z.object({
  verificationStatus: z.enum(["approved", "rejected"]).optional(),
  isBlocked: z.boolean().optional()
}).strict();
