"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { PublicListingCardRecord } from "@/lib/types";
import { buildPropertyMarketPath } from "@/lib/property-search";

import { ListingResult } from "@/components/listings/listing-result";
import { PaginationNav } from "@/components/listings/pagination-nav";
import type { PaginationMetadata } from "@/lib/types";

type Props = {
  listings: PublicListingCardRecord[];
  hasActiveFilters?: boolean;
  queryParams?: Record<string, string | undefined>;
  showDiscoveryRail?: boolean;
  discoveryMarkets?: Array<{ state: string; label: string; count: number }>;
  pagination?: PaginationMetadata & { basePath: string; fragment?: string };
};

const popularSearches = [
  { label: "Property for rent in Nigeria", href: "/properties/for-rent" },
  { label: "Property for sale in Nigeria", href: "/properties/for-sale" },
  { label: "Short lets in Nigeria", href: "/properties/short-let" }
];

const popularRailSearches = [
  { label: "Property for rent across Nigeria", href: "/properties/for-rent" },
  { label: "Property for sale across Nigeria", href: "/properties/for-sale" },
  { label: "Short lets across Nigeria", href: "/properties/short-let" },
  { label: "Browse every Nigerian state", href: "/properties/locations" }
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

function ListingDiscoveryRail({
  queryParams,
  markets
}: {
  queryParams: Record<string, string | undefined>;
  markets: Array<{ state: string; label: string; count: number }>;
}) {
  return (
    <aside
      id="listing-discovery-rail"
      className="h-fit w-[15.5rem] space-y-5 text-sm text-slate-700 2xl:w-[17rem]"
    >
      <section className="border-b border-slate-200 pb-5">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Explore by state</h2>
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5">
          {markets.map((state) => (
            <Link
              key={state.state}
              href={buildPropertyMarketPath({ state: state.state })}
              className="font-bold text-slate-700 transition hover:text-teal-700 hover:underline"
            >
              {state.label} <span className="text-[0.65rem] text-slate-400">{state.count}</span>
            </Link>
          ))}
          <Link href="/properties/locations" className="font-black text-teal-700 hover:underline">
            All states
          </Link>
        </div>
      </section>

      <section className="border-b border-slate-200 pb-5">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Popular searches</h2>
        <div className="mt-3 space-y-2">
          {popularRailSearches.map((search) => (
            <Link
              key={search.label}
              href={search.href}
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
  queryParams = {},
  showDiscoveryRail = false,
  discoveryMarkets = [],
  pagination
}: Props) {
  const [items, setItems] = useState(listings);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [checkedSavedIds, setCheckedSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setItems(listings);
    setSavedIds(new Set());
    setCheckedSavedIds(new Set());
  }, [listings]);

  useEffect(() => {
    const uncheckedIds = items.map((listing) => listing.id).filter((listingId) => !checkedSavedIds.has(listingId));
    if (!uncheckedIds.length) {
      return;
    }

    let active = true;

    async function loadSavedState() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.access_token) {
        setCheckedSavedIds((current) => new Set([...current, ...uncheckedIds]));
        return;
      }

      try {
        const response = await apiRequest<{ savedListingIds: string[] }>(
          `/api/saved-listings?listingIds=${encodeURIComponent(uncheckedIds.join(","))}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
            retries: 0
          }
        );

        if (!active) {
          return;
        }

        setSavedIds((current) => new Set([...current, ...response.savedListingIds]));
      } catch {
        // Saved state is non-critical; the save button still performs the real action on click.
      } finally {
        if (active) {
          setCheckedSavedIds((current) => new Set([...current, ...uncheckedIds]));
        }
      }
    }

    void loadSavedState();

    return () => {
      active = false;
    };
  }, [checkedSavedIds, items]);

  function updateSavedState(listingId: string, saved: boolean) {
    setSavedIds((current) => {
      const next = new Set(current);
      if (saved) {
        next.add(listingId);
      } else {
        next.delete(listingId);
      }
      return next;
    });
    setCheckedSavedIds((current) => new Set(current).add(listingId));
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
              key={search.href}
              className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
              href={search.href}
            >
              {search.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className={
          showDiscoveryRail
            ? "xl:grid xl:grid-cols-[minmax(0,56rem)_15.5rem] xl:items-start xl:justify-start xl:gap-5 2xl:grid-cols-[minmax(0,58rem)_17rem] 2xl:gap-6"
            : ""
        }
      >
        <div className={`grid min-w-0 gap-4 md:grid-cols-2 xl:block xl:space-y-4 ${showDiscoveryRail ? "" : "mx-auto max-w-[58rem] 2xl:max-w-[60rem]"}`}>
          {items.map((listing) => (
            <ListingResult
              key={listing.id}
              listing={listing}
              initialSaved={savedIds.has(listing.id)}
              onSavedChange={updateSavedState}
            />
          ))}
        </div>
        {showDiscoveryRail ? (
          <div className="hidden xl:block">
            <ListingDiscoveryRail queryParams={queryParams} markets={discoveryMarkets} />
          </div>
        ) : null}
      </div>
      {pagination ? (
        <div className={showDiscoveryRail ? "xl:w-[56rem] 2xl:w-[58rem]" : ""}>
          <PaginationNav {...pagination} queryParams={queryParams} itemLabel="properties" />
        </div>
      ) : null}
    </div>
  );
}
