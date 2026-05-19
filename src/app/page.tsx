import type { Metadata } from "next";

import { FilterBar } from "@/components/listings/filter-bar";
import { ListingGrid } from "@/components/listings/listing-grid";
import { DEFAULT_SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { getPublicListings } from "@/modules/listings/listing.service";

const homeTitle = `Verified Property Listings in Nigeria | ${SITE_NAME}`;

export const metadata: Metadata = {
  title: {
    absolute: homeTitle
  },
  description: DEFAULT_SITE_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: homeTitle,
    description: DEFAULT_SITE_DESCRIPTION,
    url: "/",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: DEFAULT_SITE_DESCRIPTION
  }
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const listings = await getPublicListings({
    keyword: typeof params.q === "string" ? params.q : undefined,
    state: typeof params.state === "string" ? params.state : undefined,
    city: typeof params.city === "string" ? params.city : undefined,
    minPrice: typeof params.minPrice === "string" ? Number(params.minPrice) : undefined,
    maxPrice: typeof params.maxPrice === "string" ? Number(params.maxPrice) : undefined,
    propertyType: typeof params.propertyType === "string" ? params.propertyType : undefined,
    listingCategory: typeof params.listingCategory === "string" ? params.listingCategory : undefined
  });

  return (
    <div className="space-y-8">
      <section
        className="relative left-1/2 -mt-8 w-screen -translate-x-1/2 overflow-hidden bg-slate-950 px-4 py-1 text-center text-amber-50 sm:px-6 sm:py-3 lg:py-4"
        style={{
          backgroundImage: 'url("/pageima.PNG")',
          backgroundPosition: "center",
          backgroundSize: "cover"
        }}
      >
        <div className="absolute inset-0 bg-stone-950/75 mix-blend-multiply" aria-hidden="true" />
        <div className="absolute inset-0 bg-slate-950/83" aria-hidden="true" />
        <div className="relative">
          <p className="text-[clamp(0.78rem,2.7vw,1.125rem)] font-semibold uppercase tracking-[0.24em] text-amber-200 sm:tracking-[0.34em]">
            Property search
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-[clamp(0.82rem,3.4vw,0.95rem)] leading-6 text-stone-100 sm:mt-5 sm:leading-7">
            Built for mobile-first browsing, low bandwidth, and fast contact with verified agents.
          </p>
          <div className="mx-auto mt-6 max-w-6xl text-left sm:mt-8">
            <FilterBar
              initialKeyword={typeof params.q === "string" ? params.q : undefined}
              initialState={typeof params.state === "string" ? params.state : undefined}
              initialCity={typeof params.city === "string" ? params.city : undefined}
              initialMinPrice={typeof params.minPrice === "string" ? Number(params.minPrice) : undefined}
              initialMaxPrice={typeof params.maxPrice === "string" ? Number(params.maxPrice) : undefined}
              initialType={typeof params.propertyType === "string" ? params.propertyType : undefined}
              initialCategory={typeof params.listingCategory === "string" ? params.listingCategory : undefined}
            />
          </div>
        </div>
      </section>
      <section id="search-results" className="scroll-mt-24">
        <ListingGrid listings={listings.items} />
      </section>
    </div>
  );
}
