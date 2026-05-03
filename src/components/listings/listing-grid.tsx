import { ListingRecord } from "@/lib/types";

import { ListingCard } from "@/components/listings/listing-card";

type Props = {
  listings: ListingRecord[];
};

export function ListingGrid({ listings }: Props) {
  if (!listings.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No listings matched these filters.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
