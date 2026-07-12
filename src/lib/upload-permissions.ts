import type { VerificationStatus } from "@/lib/types";

type AgentUploadState = {
  verification_status?: VerificationStatus | null;
  is_blocked?: boolean | null;
} | null;

export function getListingImageUploadBlockReason(agent: AgentUploadState) {
  if (!agent) {
    return "Agent profile was not found.";
  }

  if (agent.is_blocked) {
    return "Your agent account is blocked and cannot upload listing images.";
  }

  if (agent.verification_status === "rejected") {
    return "Your agent account was rejected and cannot upload listing images.";
  }

  return null;
}
