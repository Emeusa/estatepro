import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { ListingRecord } from "@/lib/types";

type Props = {
  listing: ListingRecord;
};

export function ListingCard({ listing }: Props) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-52 bg-slate-100">
        <Image
          src={listing.imageUrls[0]}
          alt={listing.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-950">{listing.title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {listing.location.area}, {listing.location.city}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            {listing.propertyType}
          </span>
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
