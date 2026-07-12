import { z } from "zod";

const optionalContactText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable().optional()
  );

export const reportReasonSchema = z.enum([
  "fake",
  "unavailable",
  "duplicate",
  "wrong_price",
  "scam",
  "payment_request",
  "impersonation",
  "unsafe_agent",
  "other"
]);

export const publicListingReportSchema = z.object({
  reason: reportReasonSchema,
  details: z.string().trim().min(20).max(1000),
  reporterName: optionalContactText(120),
  reporterEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().email().max(320).nullable().optional()
  ),
  reporterPhone: optionalContactText(40)
}).strict();

export const adminReportQuerySchema = z.object({
  status: z.enum(["all", "open", "reviewing", "reviewed", "dismissed", "resolved", "high_risk"]).optional(),
  listingId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const adminReportUpdateSchema = z.object({
  status: z.enum(["open", "reviewing", "dismissed", "resolved"]).optional(),
  adminNotes: z.string().trim().max(2000).nullable().optional(),
  resolutionNotes: z.string().trim().max(2000).nullable().optional(),
  legalHoldListing: z.boolean().optional(),
  hideListing: z.boolean().optional(),
  blockAgent: z.boolean().optional(),
  requestAgentResponseMessage: z.string().trim().min(10).max(1200).optional()
}).strict();

export type PublicListingReportInput = z.infer<typeof publicListingReportSchema>;
export type AdminReportQuery = z.infer<typeof adminReportQuerySchema>;
export type AdminReportUpdateInput = z.infer<typeof adminReportUpdateSchema>;
