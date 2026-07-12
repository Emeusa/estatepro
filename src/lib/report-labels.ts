import type { ListingReportReason } from "@/lib/types";

export const REPORT_REASON_LABELS: Record<ListingReportReason, string> = {
  fake: "Fake property",
  unavailable: "Property is unavailable",
  duplicate: "Duplicate listing",
  wrong_price: "Wrong or misleading price",
  scam: "Possible scam",
  payment_request: "Suspicious payment request",
  impersonation: "Agent impersonation",
  unsafe_agent: "Unsafe agent behavior",
  other: "Other concern"
};
