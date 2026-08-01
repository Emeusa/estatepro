import type { Metadata } from "next";
import Link from "next/link";

import { PROPERTY_GUIDES } from "@/content/guides";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: `Nigeria property guides and safety | ${SITE_NAME}` },
  description: "Practical Nigeria-wide guidance for safer property searches, agent checks, renting, land purchases, and payments.",
  alternates: { canonical: "/guides" }
};

export default function GuidesPage() {
  return (
    <div className="space-y-8">
      <header className="rounded-[2rem] bg-gradient-to-br from-teal-950 via-slate-950 to-slate-900 px-6 py-10 text-white sm:px-9">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Nigeria property knowledge</p>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold sm:text-4xl">Property guides built for safer decisions</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Independent checks remain necessary in every transaction. These guides explain practical steps without promising that a listing, title, agent statement, or payment is risk-free.</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {PROPERTY_GUIDES.map((guide) => (
          <article key={guide.slug} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">Reviewed {guide.updatedAt}</p>
            <h2 className="mt-3 font-heading text-2xl font-semibold text-slate-950">{guide.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{guide.description}</p>
            <Link href={`/guides/${guide.slug}`} className="mt-5 font-black text-teal-700 hover:underline">Read guide</Link>
          </article>
        ))}
      </section>
    </div>
  );
}
