import Image from "next/image";

type Props = {
  fullName: string;
  isVerified: boolean;
  className?: string;
};

export function VerifiedAgentName({ fullName, isVerified, className }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span>{fullName}</span>
      {isVerified ? (
        <span
          className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white/90 shadow-sm ring-1 ring-emerald-100"
          title="Verified agent"
          aria-label="Verified agent"
        >
          <Image
            src="/verifica.webp"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 rounded-full object-cover mix-blend-multiply"
          />
        </span>
      ) : null}
    </span>
  );
}
