import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { getUnavailableBadge, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { ListingRecord } from "@/lib/types";

type Props = {
  listing: ListingRecord;
};

export function ListingCard({ listing }: Props) {
  const unavailableBadge = getUnavailableBadge(listing);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-52 bg-slate-100">
        <Image
          src={listing.imageUrls[0]}
          alt={listing.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px"
          quality={70}
        />
        {unavailableBadge ? (
          <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            {unavailableBadge}
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-950">{listing.title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {listing.location.area}, {listing.location.city}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {LISTING_CATEGORY_LABELS[listing.listingCategory]}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium capitalize text-emerald-700">
              {listing.propertyType}
            </span>
          </div>
        </div>
        <p className="text-lg font-semibold text-slate-950">{formatPrice(listing.price)}</p>
        <Link
          href={`/listings/${listing.id}`}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
