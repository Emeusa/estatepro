import { z } from "zod";

import { normalizePhone, sanitizeText } from "@/lib/sanitize";

export const agentRegistrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  fullName: z.string().min(3).max(120).transform(sanitizeText),
  phone: z.string().min(10).max(20).transform(normalizePhone),
  verificationDocuments: z.array(z.string().url()).max(4).default([])
});

export const clientRegistrationSchema = z.object({
  email: z.string().email(),
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
});

export const userProfileSchema = z.object({
  fullName: z.string().min(2).max(120).transform(sanitizeText),
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
});
