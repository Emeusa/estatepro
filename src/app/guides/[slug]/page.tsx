import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPropertyGuide, PROPERTY_GUIDES } from "@/content/guides";
import { getSiteUrl, SITE_NAME } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PROPERTY_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getPropertyGuide((await params).slug);
  if (!guide) return { title: "Guide not found", robots: { index: false, follow: false } };
  return {
    title: { absolute: `${guide.title} | ${SITE_NAME}` },
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description, type: "article", url: `/guides/${guide.slug}` }
  };
}

export default async function GuidePage({ params }: Props) {
  const guide = getPropertyGuide((await params).slug);
  if (!guide) notFound();
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    author: { "@type": "Organization", name: guide.author },
    publisher: { "@type": "Organization", name: SITE_NAME, url: siteUrl },
    mainEntityOfPage: `${siteUrl}/guides/${guide.slug}`
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${siteUrl}/guides` },
      { "@type": "ListItem", position: 3, name: guide.title }
    ]
  };

  return (
    <article className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-sm font-bold text-teal-700"><Link href="/guides" className="hover:underline">Property guides</Link></nav>
      <header className="mt-5 border-b border-slate-200 pb-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Nigeria property safety</p>
        <h1 className="mt-3 font-heading text-4xl font-semibold leading-tight text-slate-950">{guide.title}</h1>
        <p className="mt-4 text-base leading-8 text-slate-600">{guide.description}</p>
        <dl className="mt-5 grid gap-2 text-xs font-semibold text-slate-500 sm:grid-cols-2">
          <div><dt className="inline font-black text-slate-700">Author: </dt><dd className="inline">{guide.author}</dd></div>
          <div><dt className="inline font-black text-slate-700">Reviewed by: </dt><dd className="inline">{guide.reviewer}</dd></div>
          <div><dt className="inline font-black text-slate-700">Published: </dt><dd className="inline">{guide.publishedAt}</dd></div>
          <div><dt className="inline font-black text-slate-700">Updated: </dt><dd className="inline">{guide.updatedAt}</dd></div>
        </dl>
      </header>
      <div className="space-y-9 py-8">
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-heading text-2xl font-semibold text-slate-950">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 leading-8 text-slate-700">{paragraph}</p>)}
            {section.checklist ? <ul className="mt-4 grid gap-2">{section.checklist.map((item) => <li key={item} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{item}</li>)}</ul> : null}
          </section>
        ))}
      </div>
      <footer className="border-t border-slate-200 py-7">
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Sources and further checks</h2>
        <div className="mt-3 flex flex-wrap gap-3">{guide.sources.map((source) => <a key={source.href} href={source.href} target={source.href.startsWith("http") ? "_blank" : undefined} rel={source.href.startsWith("http") ? "noreferrer" : undefined} className="font-bold text-teal-700 hover:underline">{source.label}</a>)}</div>
        <p className="mt-5 text-sm leading-6 text-slate-500">This guide provides general information and is not legal, financial, surveying, or title advice. Use qualified independent professionals for a transaction.</p>
      </footer>
    </article>
  );
}
