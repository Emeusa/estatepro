"use client";

import { useState } from "react";

import { ListingForm } from "@/components/forms/listing-form";
import { apiRequest } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS, getUnavailableBadge, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { ListingRecord } from "@/lib/types";

type Props = {
  token: string;
  initialListings: ListingRecord[];
};

export function ListingManager({ token, initialListings }: Props) {
  const [selected, setSelected] = useState<ListingRecord | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [listings, setListings] = useState(initialListings);

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

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">Your listings</h2>
          <button className="button-secondary" onClick={() => setSelected(undefined)}>
            New listing
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-950">{listing.title}</p>
                  <p className="mt-1 text-sm capitalize text-slate-500">
                    {listing.status} · {LISTING_CATEGORY_LABELS[listing.listingCategory]} ·{" "}
                    {getUnavailableBadge(listing) ?? AVAILABILITY_LABELS[listing.availability]}
                  </p>
                </div>
                <span className="text-sm text-slate-500">{formatPrice(listing.price)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="button-secondary" onClick={() => setSelected(listing)}>
                  Edit
                </button>
                <button className="button-secondary" onClick={() => deleteListing(listing.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}
      </section>
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">
          {selected ? "Edit listing" : "Create listing"}
        </h2>
        <ListingForm token={token} listing={selected} onSaved={upsertListing} />
      </div>
    </div>
  );
}
