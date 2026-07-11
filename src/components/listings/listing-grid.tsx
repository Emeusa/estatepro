"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PublicListingCardRecord } from "@/lib/types";

import { ListingCard } from "@/components/listings/listing-card";

type Props = {
  listings: PublicListingCardRecord[];
  hasActiveFilters?: boolean;
  nextCursor?: string | null;
  queryParams?: Record<string, string | undefined>;
};

const popularSearches = ["Flats for rent in Lagos", "Houses for sale in Abuja", "Land for sale in Lagos"];

export function ListingGrid({ listings, hasActiveFilters = false, nextCursor = null, queryParams = {} }: Props) {
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
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
