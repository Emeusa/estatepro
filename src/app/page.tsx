import type { Metadata } from "next";
import Image from "next/image";

import { FilterBar } from "@/components/listings/filter-bar";
import { ListingGrid } from "@/components/listings/listing-grid";
import { StickyListingFilter } from "@/components/listings/sticky-listing-filter";
import {
  buildHomepageMetadata,
  getHomepageFilterValues,
  getHomepageListingQueryParams,
  hasHomepageActiveFilters,
  type HomeSearchParams
} from "@/lib/homepage-filters";
import { getPublicListings } from "@/modules/listings/listing.service";

type Props = {
  searchParams: Promise<HomeSearchParams>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return buildHomepageMetadata(await searchParams);
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const filterValues = getHomepageFilterValues(params);
  const listingQueryParams = getHomepageListingQueryParams(params);
  const hasActiveFilters = hasHomepageActiveFilters(params);
  const listings = await getPublicListings({
    keyword: filterValues.initialKeyword,
    state: filterValues.initialState,
    city: filterValues.initialCity,
    minPrice: filterValues.initialMinPrice,
    maxPrice: filterValues.initialMaxPrice,
    bedrooms: filterValues.initialBedrooms,
    bathrooms: filterValues.initialBathrooms,
    propertyType: filterValues.initialType,
    listingCategory: filterValues.initialCategory
  });

  return (
    <div className="space-y-8">
      <section
        className="relative left-1/2 -mt-8 w-screen -translate-x-1/2 overflow-hidden bg-slate-950 px-4 py-1 text-center text-amber-50 sm:px-6 sm:py-3 lg:py-2"
      >
        <Image
          src="/homepage-hero.webp"
          alt="C59 Estatehub"
          fill
          priority
          sizes="100vw"
          quality={78}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-stone-950/75 mix-blend-multiply" aria-hidden="true" />
        <div className="absolute inset-0 bg-slate-950/83" aria-hidden="true" />
        <div className="relative">
          <p className="text-[clamp(0.78rem,2.7vw,1.125rem)] font-semibold uppercase tracking-[0.24em] text-amber-200 sm:tracking-[0.34em]">
            Property search
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-[clamp(0.82rem,3.4vw,0.95rem)] leading-6 text-stone-100 sm:mt-5 sm:leading-7 lg:mt-2 lg:leading-5">
            Built for fast contact with verified agents.
          </p>
          <div id="homepage-filter-anchor" className="mx-auto mt-6 max-w-6xl text-left sm:mt-8 lg:mt-4">
            <FilterBar {...filterValues} />
          </div>
        </div>
      </section>
      <StickyListingFilter
        anchorId="homepage-filter-anchor"
        deferUntilElementId="listing-discovery-rail"
        {...filterValues}
      />
      <section
        id="search-results"
        className="relative left-1/2 w-screen max-w-[82rem] -translate-x-1/2 scroll-mt-24 px-4 sm:px-6"
      >
        <ListingGrid
          listings={listings.items}
          hasActiveFilters={hasActiveFilters}
          nextCursor={listings.nextCursor}
          queryParams={listingQueryParams}
          showDiscoveryRail
        />
      </section>
    </div>
  );
}
