import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ListingGrid } from "@/components/listings/listing-grid";
import { formatDate } from "@/lib/format";
import {
  buildPropertyMarketPath,
  getMarketDescription,
  getMarketTitle,
  getPropertyTypeSegment,
  parsePropertyMarketSegments,
  type PropertyMarketRoute
} from "@/lib/property-search";
import { getSiteUrl, SITE_NAME, trimMetaDescription } from "@/lib/seo";
import type { PropertyType } from "@/lib/types";
import { getPublicMarketPage } from "@/modules/listings/listing.service";
import { resolveMarketIndexability } from "@/modules/seo/seo-market.service";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<SearchParams>;
};

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartments",
  duplex: "Duplexes",
  land: "Land",
  office: "Offices",
  shop: "Shops"
};

const getBaseMarketContext = cache(async (segmentsKey: string) => {
  const route = parsePropertyMarketSegments(segmentsKey ? segmentsKey.split("/") : []);
  if (!route) return null;
  const page = await getPublicMarketPage({
    state: route.state,
    city: route.city,
    propertyType: route.propertyType,
    listingCategory: route.category
  });
  const indexability = await resolveMarketIndexability(route, page);
  return { route, page, indexability };
});

function stringParam(params: SearchParams, key: string) {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberParam(params: SearchParams, key: string) {
  const value = stringParam(params, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? value : undefined;
}

function hasAdvancedFilters(params: SearchParams) {
  return ["minPrice", "maxPrice", "bedrooms", "bathrooms"].some((key) => Boolean(stringParam(params, key)));
}

function buildCanonical(route: PropertyMarketRoute, page: number, filtered: boolean) {
  if (filtered || page <= 1) return route.path;
  return `${route.path}?page=${page}`;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ segments = [] }, query] = await Promise.all([params, searchParams]);
  const context = await getBaseMarketContext(segments.join("/"));
  if (!context) {
    return { title: "Property market not found", robots: { index: false, follow: false } };
  }

  const page = Math.max(1, Math.trunc(Number(stringParam(query, "page") ?? "1") || 1));
  const filtered = hasAdvancedFilters(query);
  const title = `${getMarketTitle(context.route)} | ${SITE_NAME}`;
  const description = trimMetaDescription(getMarketDescription(context.route, context.page.listingCount));
  const canonical = buildCanonical(context.route, page, filtered);
  const indexable = context.indexability.eligible && !filtered && page <= context.page.totalPages;

  return {
    title: { absolute: page > 1 ? `${title} - Page ${page}` : title },
    description,
    alternates: { canonical },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary", title, description }
  };
}

export default async function PropertyMarketPage({ params, searchParams }: Props) {
  const [{ segments = [] }, query] = await Promise.all([params, searchParams]);
  const context = await getBaseMarketContext(segments.join("/"));
  if (!context) notFound();

  const currentPage = Math.max(1, Math.trunc(Number(stringParam(query, "page") ?? "1") || 1));
  const filters = {
    minPrice: numberParam(query, "minPrice"),
    maxPrice: numberParam(query, "maxPrice"),
    bedrooms: numberParam(query, "bedrooms"),
    bathrooms: numberParam(query, "bathrooms")
  };
  const filtered = hasAdvancedFilters(query);
  const result = filtered || currentPage !== 1
    ? await getPublicMarketPage(
        {
          state: context.route.state,
          city: context.route.city,
          propertyType: context.route.propertyType,
          listingCategory: context.route.category,
          ...filters
        },
        currentPage
      )
    : context.page;

  if (currentPage > result.totalPages && result.listingCount > 0) notFound();

  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  const title = getMarketTitle(context.route);
  const breadcrumbs = [
    { name: "Home", item: siteUrl },
    { name: "Properties", item: `${siteUrl}/properties` },
    ...(context.route.stateLabel
      ? [{ name: context.route.stateLabel, item: `${siteUrl}${buildPropertyMarketPath({ state: context.route.state })}` }]
      : []),
    ...(context.route.city ? [{ name: context.route.city, item: `${siteUrl}${context.route.path}` }] : [])
  ];
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.item
    }))
  };
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    numberOfItems: result.listingCount,
    itemListElement: result.items.map((listing, index) => ({
      "@type": "ListItem",
      position: (currentPage - 1) * 12 + index + 1,
      url: `${siteUrl}/listings/${listing.slug}`,
      name: listing.title
    }))
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <header className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 px-5 py-8 text-white sm:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-xs font-bold text-amber-200">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.name}-${index}`} className="inline-flex items-center gap-2">
              {index ? <span aria-hidden="true">/</span> : null}
              <Link href={crumb.item.replace(siteUrl, "") || "/"} className="hover:underline">{crumb.name}</Link>
            </span>
          ))}
        </nav>
        <h1 className="mt-5 max-w-4xl font-heading text-3xl font-semibold capitalize sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
          {getMarketDescription(context.route, context.page.listingCount)}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold">
          <span className="rounded-full bg-white/10 px-3 py-2">{context.page.listingCount} active properties</span>
          {context.page.latestUpdatedAt ? (
            <span className="rounded-full bg-white/10 px-3 py-2">Updated {formatDate(context.page.latestUpdatedAt)}</span>
          ) : null}
          <span className="rounded-full bg-emerald-400/15 px-3 py-2 text-emerald-200">Approved agent contact</span>
        </div>
      </header>

      <form action={context.route.path} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-5">
        <input name="minPrice" inputMode="numeric" defaultValue={filters.minPrice} placeholder="Min. price" className="input" />
        <input name="maxPrice" inputMode="numeric" defaultValue={filters.maxPrice} placeholder="Max. price" className="input" />
        <input name="bedrooms" inputMode="numeric" defaultValue={filters.bedrooms} placeholder="Bedrooms" className="input" />
        <input name="bathrooms" inputMode="numeric" defaultValue={filters.bathrooms} placeholder="Bathrooms" className="input" />
        <button className="rounded-2xl bg-[#430078] px-5 py-3 text-sm font-black text-white">Refine results</button>
      </form>

      {(context.page.activeCities.length > 1 || context.page.activePropertyTypes.length > 1) ? (
        <section className="grid gap-5 border-y border-slate-200 py-5 lg:grid-cols-2">
          {context.route.state && !context.route.city && context.page.activeCities.length ? (
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Browse active localities</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {context.page.activeCities.slice(0, 16).map((city) => (
                  <Link
                    key={city.name}
                    href={context.route.category ? buildPropertyMarketPath({ state: context.route.state, city: city.name, category: context.route.category }) : `/?state=${encodeURIComponent(context.route.state ?? "")}&city=${encodeURIComponent(city.name)}`}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-teal-600"
                  >
                    {city.name} ({city.count})
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {context.route.city && context.route.category && !context.route.propertyType && context.page.activePropertyTypes.length ? (
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Property types</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {context.page.activePropertyTypes.map((item) => (
                  <Link
                    key={item.propertyType}
                    href={`${context.route.path}/${getPropertyTypeSegment(item.propertyType)}`}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-teal-600"
                  >
                    {PROPERTY_TYPE_LABELS[item.propertyType]} ({item.count})
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!context.indexability.eligible ? (
        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          This market is growing on C59 Estatehub. Listings remain available to visitors, while search indexing activates automatically as fresh inventory grows. Agents can <Link href="/agents/register" className="font-black underline">add properties for this market</Link>.
        </aside>
      ) : null}

      <section aria-labelledby="property-results-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Current inventory</p>
            <h2 id="property-results-heading" className="mt-1 font-heading text-2xl font-semibold text-slate-950">Available properties</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">Page {result.currentPage} of {result.totalPages}</p>
        </div>
        <ListingGrid
          listings={result.items}
          hasActiveFilters={filtered}
          pagination={{ currentPage: result.currentPage, totalPages: result.totalPages, basePath: context.route.path }}
        />
      </section>

      <aside className="rounded-3xl bg-slate-950 p-5 text-sm leading-7 text-slate-200 sm:p-7">
        <h2 className="font-heading text-xl font-semibold text-amber-100">Property safety comes first</h2>
        <p className="mt-2">Confirm the property, agent identity, ownership or mandate, and payment details before paying inspection, rent, agency, or purchase fees.</p>
        <div className="mt-3 flex gap-4 font-bold text-amber-200">
          <Link href="/guides/verify-a-property-agent" className="hover:underline">Verification guide</Link>
          <Link href="/terms" className="hover:underline">Safety rules</Link>
        </div>
      </aside>
    </div>
  );
}
