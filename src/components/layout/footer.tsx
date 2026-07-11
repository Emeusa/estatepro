import Link from "next/link";

const popularKeywords = [
  "Flats for rent in Abuja",
  "Houses for rent in Abuja",
  "Houses for sale in Abuja",
  "Land for sale in Abuja",
  "Mini flats for rent in Abuja",
  "Self contain for rent in Abuja",
  "Flats for rent in Lagos",
  "Houses for rent in Lagos",
  "Houses for sale in Lagos",
  "Land for sale in Lagos",
  "Mini flats for rent in Lagos",
  "Self contain for rent in Lagos"
];

const socialLinks = [
  {
    label: "Facebook",
    href: "https://www.facebook.com",
    icon: (
      <path d="M13.5 20v-7h2.3l.4-2.7h-2.7V8.6c0-.8.2-1.3 1.4-1.3h1.5V4.9c-.7-.1-1.5-.2-2.2-.2-2.2 0-3.8 1.4-3.8 3.8v1.8H8v2.7h2.4v7h3.1Z" />
    )
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com",
    icon: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="4" />
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="16.4" cy="7.6" r="1" />
      </>
    )
  },
  {
    label: "X",
    href: "https://x.com",
    icon: <path d="m5 5 5.5 7.4L5.4 19h2.4l3.8-4.9 3.6 4.9H19l-5.9-8L17.8 5h-2.4l-3.3 4.3L8.9 5H5Z" />
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com",
    icon: (
      <path d="M6.2 9.5h3V19h-3V9.5Zm1.5-4.7a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Zm3.6 4.7h2.9v1.3h.1c.4-.8 1.4-1.6 2.8-1.6 3 0 3.6 2 3.6 4.6V19h-3v-4.6c0-1.1 0-2.5-1.5-2.5s-1.8 1.2-1.8 2.4V19h-3V9.5Z" />
    )
  }
];

const legalLinks = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" }
];

export function Footer() {
  return (
    <footer id="site-footer" className="mt-12 border-t border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_1.4fr_0.65fr]">
        <section>
          <p className="font-heading text-2xl font-semibold text-amber-100">C59 Estatehub</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-slate-300">
            About us: C59 Estatehub connects property seekers with verified listings and agent-managed property
            information across Nigeria, with a mobile-first experience built for fast browsing.
          </p>
          <div className="mt-5 flex gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-amber-100 transition hover:bg-amber-100 hover:text-slate-950"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                  {social.icon}
                </svg>
              </a>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-200">Popular Properties</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {popularKeywords.map((keyword) => (
              <Link
                key={keyword}
                href={`/?q=${encodeURIComponent(keyword)}`}
                className="text-sm text-slate-300 transition hover:text-amber-100"
              >
                {keyword}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-200">Legal</h2>
          <div className="mt-4 grid gap-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-300 transition hover:text-amber-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </footer>
  );
}
