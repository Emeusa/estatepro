type Props = {
  className?: string;
  title?: string;
};

export function VerifiedBadgeIcon({ className, title = "Verified agent" }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-emerald-500 to-teal-600 text-white shadow-[0_2px_8px_rgba(15,118,110,0.35)] ring-2 ring-white ${className ?? "h-5 w-5"}`}
      title={title}
      aria-label={title}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[72%] w-[72%] fill-current">
        <path d="M12 1.85 14.32 4l3.16-.16 1.02 2.99 2.52 1.91-1.12 2.95.74 3.08-2.58 1.83-1.4 2.84-3.14-.27L12 22.15l-1.52-2.98-3.14.27-1.4-2.84-2.58-1.83.74-3.08-1.12-2.95L5.5 6.83l1.02-2.99L9.68 4 12 1.85Zm4.23 8.08a1.05 1.05 0 0 0-1.48-1.48l-3.8 3.8-1.7-1.7a1.05 1.05 0 1 0-1.48 1.48l2.44 2.44c.41.41 1.07.41 1.48 0l4.54-4.54Z" />
      </svg>
    </span>
  );
}
