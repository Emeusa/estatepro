"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ListingCard } from "@/components/listings/listing-card";
import { PaginationNav } from "@/components/listings/pagination-nav";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { PaginationMetadata, PublicListingCardRecord } from "@/lib/types";

type AccountResponse = {
  user: {
    fullName: string;
    role: "client" | "agent" | "admin";
  } | null;
};

type SavedListingsResponse = {
  items: PublicListingCardRecord[];
  pagination: PaginationMetadata;
};

function dashboardHrefForRole(role?: "client" | "agent" | "admin") {
  if (role === "agent") return "/agents/dashboard";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

function SavedListingsContent() {
  const searchParams = useSearchParams();
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [items, setItems] = useState<PublicListingCardRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [account, setAccount] = useState<AccountResponse["user"]>(null);
  const [message, setMessage] = useState("Loading saved listings...");

  useEffect(() => {
    let active = true;

    async function loadSavedListings() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        window.location.assign(`/login?next=${encodeURIComponent("/saved-listings")}`);
        return;
      }

      try {
        const [accountResponse, savedResponse] = await Promise.all([
          apiRequest<AccountResponse>("/api/auth/me", {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          apiRequest<SavedListingsResponse>(`/api/saved-listings?page=${currentPage}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        ]);

        if (active) {
          setAccount(accountResponse.user);
          setItems(savedResponse.items);
          setPagination(savedResponse.pagination);
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Could not load saved listings.");
        }
      }
    }

    loadSavedListings();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadSavedListings();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [currentPage]);

  function handleSavedChange(listingId: string, saved: boolean) {
    if (!saved) {
      setItems((current) => current.filter((listing) => listing.id !== listingId));
      setPagination((current) => current ? { ...current, totalItems: Math.max(0, current.totalItems - 1) } : current);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-900 to-slate-900 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Saved homes</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Saved listings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
          Your saved listings are live references. If an agent updates or removes a listing, this page reflects the
          current public version.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/#search-results"
            className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-300"
          >
            Browse listings
          </Link>
          {account ? (
            <Link
              href={dashboardHrefForRole(account.role)}
              className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-black text-white ring-1 ring-white/20 transition hover:bg-white/16"
            >
              Back to dashboard
            </Link>
          ) : null}
        </div>
      </div>

      {message ? <p className="text-sm font-semibold text-slate-500">{message}</p> : null}

      {!message && !items.length ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          <p className="text-base font-semibold text-slate-950">No saved listings yet.</p>
          <p className="mx-auto mt-2 max-w-md leading-6">
            Tap the heart icon on any listing card or listing detail page to keep it here.
          </p>
          <Link
            className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
            href="/#search-results"
          >
            Find properties
          </Link>
        </div>
      ) : null}

      {items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              initialSaved
              onSavedChange={handleSavedChange}
            />
          ))}
        </div>
      ) : null}
      {pagination ? (
        <PaginationNav {...pagination} basePath="/saved-listings" itemLabel="saved listings" />
      ) : null}
    </section>
  );
}

export default function SavedListingsPage() {
  return (
    <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Loading saved listings...</p>}>
      <SavedListingsContent />
    </Suspense>
  );
}
