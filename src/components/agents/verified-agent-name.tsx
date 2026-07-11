import { VerifiedBadgeIcon } from "@/components/agents/verified-badge";

type Props = {
  fullName: string;
  isVerified: boolean;
  className?: string;
};

export function VerifiedAgentName({ fullName, isVerified, className }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span>{fullName}</span>
      {isVerified ? <VerifiedBadgeIcon /> : null}
    </span>
  );
}
