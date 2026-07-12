"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PublicListingCardRecord } from "@/lib/types";

import { ListingDesktopRow } from "@/components/listings/listing-desktop-row";
import { ListingCard } from "@/components/listings/listing-card";

type Props = {
  listings: PublicListingCardRecord[];
  hasActiveFilters?: boolean;
  nextCursor?: string | null;
  queryParams?: Record<string, string | undefined>;
  showDiscoveryRail?: boolean;
};

const popularSearches = ["Flats for rent in Lagos", "Houses for sale in Abuja", "Land for sale in Lagos"];

const exploreStates = [
  { label: "Lagos", value: "Lagos" },
  { label: "Abuja", value: "Federal Capital Territory" },
  { label: "Rivers", value: "Rivers" },
  { label: "Oyo", value: "Oyo" },
  { label: "Ogun", value: "Ogun" },
  { label: "Enugu", value: "Enugu" },
  { label: "Edo", value: "Edo" },
  { label: "Delta", value: "Delta" },
  { label: "Akwa Ibom", value: "Akwa Ibom" },
  { label: "Kano", value: "Kano" },
  { label: "Anambra", value: "Anambra" },
  { label: "Cross River", value: "Cross River" }
];

const popularRailSearches = [
  { label: "Flats for rent in Lagos", params: { q: "flats", state: "Lagos", listingCategory: "for_rent" } },
  {
    label: "Houses for sale in Abuja",
    params: { q: "houses", state: "Federal Capital Territory", listingCategory: "for_sale" }
  },
  { label: "Land for sale in Lagos", params: { state: "Lagos", propertyType: "land", listingCategory: "for_sale" } },
  { label: "Self contain for rent", params: { q: "self contain", listingCategory: "for_rent" } },
  { label: "Short let in Lagos", params: { state: "Lagos", listingCategory: "short_let" } }
];

const quickFilters = [
  { label: "1 Bed+", params: { bedrooms: "1" } },
  { label: "2 Beds+", params: { bedrooms: "2" } },
  { label: "3 Beds+", params: { bedrooms: "3" } },
  { label: "Land", params: { propertyType: "land" } },
  { label: "For Rent", params: { listingCategory: "for_rent" } },
  { label: "For Sale", params: { listingCategory: "for_sale" } }
];

type QueryValue = string | null | undefined;

function buildSearchHref(
  baseParams: Record<string, string | undefined>,
  overrides: Record<string, QueryValue>,
  preserveBase = true
) {
  const params = new URLSearchParams();

  if (preserveBase) {
    Object.entries(baseParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
  }

  Object.entries(overrides).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });

  const query = params.toString();
  return query ? `/?${query}#search-results` : "/#search-results";
}

function ListingDiscoveryRail({ queryParams }: { queryParams: Record<string, string | undefined> }) {
  return (
    <aside
      id="listing-discovery-rail"
      className="h-fit w-[15.5rem] space-y-5 text-sm text-slate-700 2xl:w-[17rem]"
    >
      <section className="border-b border-slate-200 pb-5">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Explore by state</h2>
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5">
          {exploreStates.map((state) => (
            <Link
              key={state.value}
              href={buildSearchHref(queryParams, { state: state.value, city: null })}
              className="font-bold text-slate-700 transition hover:text-teal-700 hover:underline"
            >
              {state.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="border-b border-slate-200 pb-5">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Popular searches</h2>
        <div className="mt-3 space-y-2">
          {popularRailSearches.map((search) => (
            <Link
              key={search.label}
              href={buildSearchHref(queryParams, { ...search.params, city: null }, false)}
              className="block rounded-xl px-1 py-1 font-bold leading-5 text-slate-800 transition hover:bg-teal-50 hover:text-teal-800"
            >
              {search.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="border-b border-slate-200 pb-5">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Quick filters</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickFilters.map((filter) => (
            <Link
              key={filter.label}
              href={buildSearchHref(queryParams, filter.params)}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:border-teal-600 hover:bg-teal-50 hover:text-teal-800"
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </section>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        Verify property and agent before payment.{" "}
        <Link href="/terms" className="font-black text-teal-700 underline-offset-4 hover:underline">
          Read safety rules
        </Link>
      </p>
    </aside>
  );
}

export function ListingGrid({
  listings,
  hasActiveFilters = false,
  nextCursor = null,
  queryParams = {},
  showDiscoveryRail = false
}: Props) {
  const [items, setItems] = useState(listings);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(listings);
    setCursor(nextCursor);
    setError("");
  }, [listings, nextCursor]);

  async function loadMore() {
    if (!cursor || loading) {
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    params.set("limit", "12");
    params.set("cursor", cursor);

    try {
      const response = await fetch(`/api/listings?${params.toString()}`, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error("Could not load more listings.");
      }
      const data = (await response.json()) as {
        items: PublicListingCardRecord[];
        nextCursor: string | null;
      };
      setItems((current) => {
        const seen = new Set(current.map((listing) => listing.id));
        return [...current, ...data.items.filter((listing) => !seen.has(listing.id))];
      });
      setCursor(data.nextCursor);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load more listings.");
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 sm:p-10">
        <p className="text-base font-semibold text-slate-950">
          {hasActiveFilters ? "No listings matched these filters." : "No listings are available yet."}
        </p>
        <p className="mx-auto mt-2 max-w-md leading-6">
          Try clearing the filters or start with a popular property search.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {hasActiveFilters ? (
            <Link
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
              href="/#search-results"
            >
              Clear filters
            </Link>
          ) : null}
          <Link
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            href="/#search-results"
          >
            View all listings
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {popularSearches.map((search) => (
            <Link
              key={search}
              className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
              href={`/?q=${encodeURIComponent(search)}#search-results`}
            >
              {search}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:hidden">
        {items.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
      {showDiscoveryRail ? (
        <div className="hidden xl:grid xl:grid-cols-[minmax(0,56rem)_15.5rem] xl:items-start xl:justify-start xl:gap-5 2xl:grid-cols-[minmax(0,58rem)_17rem] 2xl:gap-6">
          <div className="min-w-0 space-y-4">
            {items.map((listing) => (
              <ListingDesktopRow key={listing.id} listing={listing} />
            ))}
          </div>
          <ListingDiscoveryRail queryParams={queryParams} />
        </div>
      ) : (
        <div className="hidden xl:block">
          <div className="mx-auto max-w-[58rem] space-y-4 2xl:max-w-[60rem]">
            {items.map((listing) => (
              <ListingDesktopRow key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      )}
      {cursor ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Loading properties..." : "Load more properties"}
          </button>
          {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
