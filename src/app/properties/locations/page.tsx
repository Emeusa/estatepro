import type { Metadata } from "next";
import Link from "next/link";

import { NIGERIA_STATES } from "@/lib/nigeria-locations";
import { buildPropertyMarketPath, getPublicStateLabel } from "@/lib/property-search";
import { SITE_NAME } from "@/lib/seo";
import { getPublicMarketFacets } from "@/modules/listings/listing.service";

export const metadata: Metadata = {
  title: { absolute: `Property listings by Nigerian state | ${SITE_NAME}` },
  description: "Browse C59 Estatehub property markets across all 36 Nigerian states and Abuja.",
  alternates: { canonical: "/properties/locations" }
};

export default async function PropertyLocationsPage() {
  const facets = await getPublicMarketFacets();
  const counts = new Map<string, number>();
  for (const facet of facets) counts.set(facet.state, (counts.get(facet.state) ?? 0) + facet.listingCount);

  const states = NIGERIA_STATES.map((state) => ({
    state,
    label: getPublicStateLabel(state),
    count: counts.get(state) ?? 0
  })).sort((first, second) => first.label.localeCompare(second.label));

  return (
    <div className="space-y-8">
      <header className="rounded-[2rem] bg-slate-950 px-6 py-9 text-white sm:px-9">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Nationwide discovery</p>
        <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">Property listings across Nigeria</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Explore all 36 states and Abuja. Every valid market is available for browsing, and search visibility grows automatically as agents add fresh properties.
        </p>
      </header>

      <section aria-labelledby="states-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">All markets</p>
            <h2 id="states-heading" className="mt-1 font-heading text-2xl font-semibold text-slate-950">Nigerian states and Abuja</h2>
          </div>
          <Link href="/properties" className="text-sm font-black text-teal-700 hover:underline">View all properties</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {states.map((item) => (
            <Link
              key={item.state}
              href={buildPropertyMarketPath({ state: item.state })}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-teal-400 hover:text-teal-800"
            >
              <span>{item.label}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{item.count}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
