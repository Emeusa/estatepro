import { z } from "zod";

export const ADMIN_GRANT_PLAN_SLUGS = [
  "free_starter",
  "starter_agent",
  "growth_agent",
  "pro_agent",
  "agency_plus"
] as const;

export type AdminGrantPlanSlug = (typeof ADMIN_GRANT_PLAN_SLUGS)[number];

export const adminSubscriptionGrantSchema = z
  .object({
    planSlug: z.enum(ADMIN_GRANT_PLAN_SLUGS),
    expiresAt: z.string().datetime().optional(),
    reason: z.string().trim().min(3).max(240)
  })
  .strict();

export type AdminSubscriptionGrantInput = z.infer<typeof adminSubscriptionGrantSchema>;
