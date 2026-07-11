import type { Metadata } from "next";
import Link from "next/link";

import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms, listing rules, fraud prevention rules, and platform conditions for C59 Estatehub.",
  alternates: {
    canonical: "/terms"
  }
};

const agentRules = [
  "You must provide accurate identity, contact, NIN, agency, listing, price, location, ownership, mandate, and availability information.",
  "You must not impersonate a landlord, owner, developer, agent, company, government office, or any other person.",
  "You must not upload fake properties, stolen photos, misleading prices, duplicate scam listings, unavailable properties, or listings you are not authorized to market.",
  "You must promptly update a listing when it becomes sold, rented, booked, unavailable, disputed, or materially inaccurate.",
  "You must not demand fraudulent inspection fees, hidden upfront charges, or payment into suspicious accounts before the user verifies the property and landlord.",
  "You must not use C59 Estatehub to collect money for properties that do not exist, properties you cannot show, or transactions you are not legally authorized to handle."
];

const userSafetyRules = [
  "Do not pay inspection fees, rent, purchase deposits, agency fees, legal fees, or any upfront payment without verifying the agent, property, landlord, and transaction documents.",
  "Meet agents in safe open locations and inspect the property before making any payment.",
  "Verify title documents, landlord authority, tenancy terms, and ownership claims independently before paying.",
  "Report suspicious listings, fake agents, payment pressure, identity misuse, duplicate scams, wrong prices, or unavailable properties to C59 Estatehub."
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-4xl rounded-[2rem] bg-white px-5 py-8 shadow-sm ring-1 ring-slate-200 sm:px-8 lg:px-10">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">Legal</p>
      <h1 className="mt-3 font-heading text-4xl font-bold text-slate-950">Terms and Conditions</h1>
      <p className="mt-3 text-sm font-semibold text-slate-500">Last updated: July 11, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">1. About C59 Estatehub</h2>
          <p className="mt-3">
            {SITE_NAME} is a property listing marketplace that helps property seekers discover agent-managed property
            information across Nigeria. We provide listing, verification, search, promotion, subscription, reporting,
            and contact tools. We are not a party to rent, sale, inspection, agency, legal, or property ownership
            transactions arranged outside the platform.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">2. Agent registration and verification</h2>
          <p className="mt-3">
            Agents must submit truthful registration information. C59 Estatehub may verify identity, contact details,
            NIN, listing activity, account behavior, and fraud reports before approving or continuing an agent account.
            Approval may be refused, delayed, suspended, or withdrawn where we detect inaccurate information, suspicious
            behavior, user complaints, or fraud risk.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">3. Agent listing rules</h2>
          <ul className="mt-3 space-y-2">
            {agentRules.map((rule) => (
              <li key={rule} className="rounded-2xl bg-slate-50 px-4 py-3">
                {rule}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">4. Fraud, misuse, and enforcement</h2>
          <p className="mt-3">
            C59 Estatehub may remove listings, reduce visibility, reject verification, block accounts, suspend billing
            benefits, cancel promotion benefits, preserve evidence, restrict access, or cooperate with lawful requests
            where fraud, impersonation, payment abuse, fake listings, harassment, spam, or other unsafe behavior is
            suspected. Paid subscriptions, boosts, featured listings, sponsored placements, or priority support do not
            protect any agent or listing from moderation.
          </p>
          <p className="mt-3">
            Sponsored, featured, boosted, or premium visibility remains conditional on the listing being active,
            available, accurate, lawful, and connected to an approved, unblocked agent.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">5. User safety rules</h2>
          <ul className="mt-3 space-y-2">
            {userSafetyRules.map((rule) => (
              <li key={rule} className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">
                {rule}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">6. Public reports and future fraud posts</h2>
          <p className="mt-3">
            Users may report suspected fraud, scam listings, fake agents, unavailable properties, misleading prices, or
            unsafe payment requests. Reports must be truthful, evidence-based, and made in good faith. Users must not
            submit malicious, defamatory, abusive, forged, or misleading reports.
          </p>
          <p className="mt-3">
            If C59 Estatehub later publishes fraud reports or public safety posts, we may review, summarize, redact,
            decline, or remove reports. We may hide sensitive information such as NIN, bank details, private addresses,
            phone numbers not already public, payment credentials, and unverified accusations. Where practical, a
            reported agent may be given a chance to respond before public publication.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">7. Payments, subscriptions, and promotions</h2>
          <p className="mt-3">
            Subscription plans, active listing limits, boosts, featured credits, sponsored credits, and payment methods
            are governed by the plan details shown in the agent dashboard at the time of purchase. C59 Estatehub may
            reject, reverse, suspend, or limit subscription benefits where payment fails, a plan expires, fraud is
            detected, or an agent violates these terms.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">8. No transaction guarantee</h2>
          <p className="mt-3">
            C59 Estatehub may verify agents and moderate listings, but we do not guarantee ownership, title, landlord
            authority, price, availability, property condition, document validity, or transaction outcome. Users remain
            responsible for independent due diligence before paying or signing any agreement.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">9. Privacy and data</h2>
          <p className="mt-3">
            Our use of personal data is explained in the{" "}
            <Link href="/privacy" className="font-bold text-teal-700 underline">
              Privacy Policy
            </Link>
            . By using the platform or registering as an agent, you agree that we may process your information for
            account operation, verification, fraud prevention, billing, support, security, analytics, and lawful
            compliance purposes.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold text-slate-950">10. Changes and contact</h2>
          <p className="mt-3">
            We may update these terms as the platform changes. Continued use of C59 Estatehub after updates means you
            accept the updated terms. For support, reports, or legal questions, contact{" "}
            <a href="mailto:support@c59estatehub.com" className="font-bold text-teal-700 underline">
              support@c59estatehub.com
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
