"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ListingForm } from "@/components/forms/listing-form";
import { apiRequest } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS, getUnavailableBadge, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { ListingRecord } from "@/lib/types";

type Props = {
  token: string;
  initialListings: ListingRecord[];
  createRequestKey?: number;
  listLimit?: number;
  viewAllHref?: string;
  listTitle?: string;
  listEyebrow?: string;
  showForm?: boolean;
  editHrefForListing?: (listing: ListingRecord) => string;
  enableEditQueryParam?: boolean;
};

export function ListingManager({
  token,
  initialListings,
  createRequestKey = 0,
  listLimit,
  viewAllHref,
  listTitle = "Property inventory",
  listEyebrow = "My listings",
  showForm = true,
  editHrefForListing,
  enableEditQueryParam = false
}: Props) {
  const [selected, setSelected] = useState<ListingRecord | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [listings, setListings] = useState(initialListings);
  const displayedListings = typeof listLimit === "number" ? listings.slice(0, listLimit) : listings;

  useEffect(() => {
    if (!createRequestKey) {
      return;
    }
    setSelected(undefined);
    document.getElementById("listing-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [createRequestKey]);

  useEffect(() => {
    if (!enableEditQueryParam || typeof window === "undefined") {
      return;
    }

    const listingId = new URLSearchParams(window.location.search).get("editListing");
    if (!listingId) {
      return;
    }

    const listing = listings.find((item) => item.id === listingId);
    if (!listing) {
      return;
    }

    setSelected(listing);
    document.getElementById("listing-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [enableEditQueryParam, listings]);

  async function deleteListing(listingId: string) {
    try {
      await apiRequest(`/api/listings/${listingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setListings((current) => current.filter((listing) => listing.id !== listingId));
      if (selected?.id === listingId) {
        setSelected(undefined);
      }
      setMessage("Listing deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete listing.");
    }
  }

  function upsertListing(next: ListingRecord) {
    setListings((current) => {
      const index = current.findIndex((item) => item.id === next.id);
      if (index === -1) {
        return [next, ...current];
      }

      const copy = [...current];
      copy[index] = next;
      return copy;
    });
    setSelected(next);
  }

  function listingEditControl(listing: ListingRecord) {
    const editHref = editHrefForListing?.(listing);

    if (editHref) {
      return (
        <Link
          className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 transition hover:bg-slate-300"
          href={editHref}
        >
          Edit
        </Link>
      );
    }

    return (
      <button
        className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 transition hover:bg-slate-300"
        onClick={() => setSelected(listing)}
      >
        Edit
      </button>
    );
  }

  return (
    <div className={`grid gap-3 sm:gap-6 ${showForm ? "xl:grid-cols-[0.9fr_1.1fr]" : ""}`}>
      <section id="my-listings" className="rounded-xl border border-slate-300/80 bg-slate-200 p-3 shadow-sm sm:rounded-3xl sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{listEyebrow}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">{listTitle}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {viewAllHref ? (
              <Link
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800 ring-1 ring-slate-300 transition hover:bg-slate-300"
                href={viewAllHref}
              >
                View all listings
              </Link>
            ) : null}
            {showForm ? (
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                onClick={() => setSelected(undefined)}
              >
                New listing
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
          {displayedListings.length ? (
            displayedListings.map((listing) => (
              <div
                key={listing.id}
                className="rounded-xl border border-slate-300 bg-slate-300/60 p-3 transition hover:border-blue-300 hover:bg-slate-200 sm:rounded-2xl sm:p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{listing.title}</p>
                    <p className="mt-1 text-xs capitalize text-slate-500 sm:text-sm">
                      {listing.status} / {LISTING_CATEGORY_LABELS[listing.listingCategory]} /{" "}
                      {getUnavailableBadge(listing) ?? AVAILABILITY_LABELS[listing.availability]}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-700">{formatPrice(listing.price)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listingEditControl(listing)}
                  <button
                    className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-red-600 ring-1 ring-slate-300 transition hover:bg-red-100"
                    onClick={() => deleteListing(listing.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-300/60 p-4 text-sm text-slate-600">
              You have not posted any property yet.
            </p>
          )}
        </div>
        {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}
      </section>

      {showForm ? (
        <section id="listing-editor" className="scroll-mt-6">
          <div className="mb-2 sm:mb-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              {selected ? "Edit property" : "Post a property"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">
              {selected ? "Update listing details" : "Create a new listing"}
            </h2>
          </div>
          <ListingForm token={token} listing={selected} onSaved={upsertListing} />
        </section>
      ) : null}
    </div>
  );
}
