import type { Metadata } from "next";
import Link from "next/link";

import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for C59 Estatehub account, listing, verification, billing, and security data.",
  alternates: {
    canonical: "/privacy"
  }
};

const dataCategories = [
  "Account data, including name, email address, phone number, role, authentication status, and profile updates.",
  "Agent verification data, including NIN, verification status, blocked status, moderation decisions, and review history.",
  "Listing data, including titles, descriptions, prices, locations, images, image metadata, amenities, availability, contact numbers, and promotion status.",
  "Billing data, including plan, payment provider, transaction references, subscription status, billing mode, current period, and cancellation status.",
  "Security and analytics data, including request IDs, IP hashes, user agent, rate-limit events, security events, listing impressions, detail views, phone clicks, and WhatsApp clicks.",
  "Support and report data, including messages, evidence, fraud reports, account complaints, admin notes, and action history."
];

const dataUses = [
  "Create and manage user, agent, admin, listing, billing, and support accounts.",
  "Verify agents, prevent impersonation, detect fraud, investigate complaints, and enforce marketplace rules.",
  "Display public property listings, agent contact options, listing quality details, and visibility badges.",
  "Process subscriptions, payments, renewals, prepaid access, cancellations, invoices, and billing support.",
  "Rate-limit requests, block abuse, secure APIs, monitor errors, and protect the platform from bots or suspicious activity.",
  "Measure listing performance, improve search results, support paid visibility features, and provide agent analytics.",
  "Comply with applicable law, lawful requests, disputes, investigations, and safety obligations."
];

const userRights = [
  "Request access to personal data we hold about you.",
  "Request correction of inaccurate or incomplete information.",
  "Request deletion or erasure where retention is no longer required by law, contract, fraud prevention, dispute handling, or platform safety.",
  "Object to or request restriction of certain processing where applicable.",
  "Request portability of information where technically and legally applicable.",
  "Report unresolved privacy concerns to the Nigeria Data Protection Commission or another competent authority."
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-4xl rounded-[2rem] bg-white px-5 py-8 shadow-sm ring-1 ring-slate-200 sm:px-8 lg:px-10">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">Privacy</p>
      <h1 className="mt-3 font-heading text-4xl font-bold text-slate-950">Privacy Policy</h1>
      <p className="mt-3 text-sm font-semibold text-slate-500">Last updated: July 11, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">1. Overview</h2>
          <p className="mt-3">
            {SITE_NAME} processes personal data to operate a Nigerian property marketplace, verify agents, publish
            listings, prevent fraud, process subscriptions, provide support, and protect users. We apply privacy and
            security controls so sensitive information, including full NIN values, is not made public.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">2. Information we collect</h2>
          <ul className="mt-3 space-y-2">
            {dataCategories.map((item) => (
              <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">3. How we use information</h2>
          <ul className="mt-3 space-y-2">
            {dataUses.map((item) => (
              <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">4. Agent verification and NIN data</h2>
          <p className="mt-3">
            Agents submit NIN and related verification data so C59 Estatehub can reduce impersonation, fake agents, and
            property fraud. Full NIN values are not shown publicly. Access is limited to trusted admin workflows and
            server-side verification/support needs. We may retain verification records where reasonably necessary for
            fraud prevention, account safety, dispute handling, legal compliance, or audit purposes.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">5. Public listing and contact data</h2>
          <p className="mt-3">
            Listings may show property information, images, location, price, availability, agent profile information,
            and public contact actions such as phone and WhatsApp. Agents should only publish contact details and
            property details they are authorized to share.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">6. Fraud reports and future public notices</h2>
          <p className="mt-3">
            Fraud reports, scam evidence, complaint messages, and moderation records may be used to investigate unsafe
            activity and protect users. If C59 Estatehub later publishes fraud reports, blog posts, or public safety
            notices, we may redact sensitive personal data and avoid publishing unverified private information. Reports
            may be declined, edited, summarized, or removed where needed for safety, fairness, privacy, or legal risk.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">7. Service providers and disclosures</h2>
          <p className="mt-3">
            We may process information through service providers that support hosting, database, authentication,
            storage, email, billing, security, monitoring, and analytics. These may include Supabase, Vercel, payment
            providers, Zoho email services, Redis/rate-limit providers, and error monitoring tools. We may also disclose
            information where required by law, lawful requests, fraud investigation, dispute handling, or user safety.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">8. Cookies, security logs, and analytics</h2>
          <p className="mt-3">
            We may use cookies, local storage, session identifiers, IP hashing, rate-limit records, request metadata,
            and listing analytics to keep users signed in, protect forms, prevent spam, measure listing activity, and
            improve platform performance. We do not intentionally log passwords, secret keys, full payment card details,
            or private authentication tokens.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">9. Retention and deletion</h2>
          <p className="mt-3">
            We keep information for as long as needed to operate accounts, listings, billing, fraud prevention, dispute
            records, legal compliance, security monitoring, and business records. Some information may be retained after
            account closure where necessary to investigate fraud, enforce terms, resolve disputes, or comply with law.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">10. Your rights</h2>
          <ul className="mt-3 space-y-2">
            {userRights.map((right) => (
              <li key={right} className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-950">
                {right}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">11. Contact and related terms</h2>
          <p className="mt-3">
            To request privacy support, correction, deletion, or fraud-report review, contact{" "}
            <a href="mailto:support@c59estatehub.com" className="font-bold text-teal-700 underline">
              support@c59estatehub.com
            </a>
            . Platform usage rules are explained in our{" "}
            <Link href="/terms" className="font-bold text-teal-700 underline">
              Terms and Conditions
            </Link>
            .
          </p>
          <p className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-slate-100">
            This policy is a practical privacy baseline and should be reviewed by a qualified Nigerian lawyer or privacy
            professional before high-volume launch or public fraud-report publication.
          </p>
        </section>
      </div>
    </article>
  );
}
