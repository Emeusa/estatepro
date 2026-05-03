import Image from "next/image";

import { formatDate, formatPrice, whatsappLink } from "@/lib/format";
import { ListingRecord } from "@/lib/types";

type Props = {
  listing: ListingRecord;
};

export function ListingDetail({ listing }: Props) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-4">
        <div className="relative h-72 overflow-hidden rounded-3xl bg-slate-100 md:h-[28rem]">
          <Image src={listing.imageUrls[0]} alt={listing.title} fill className="object-cover" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {listing.imageUrls.slice(1, 4).map((imageUrl) => (
            <div key={imageUrl} className="relative h-28 overflow-hidden rounded-2xl bg-slate-100">
              <Image src={imageUrl} alt={listing.title} fill className="object-cover" />
            </div>
          ))}
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">{listing.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {listing.location.area}, {listing.location.city}, {listing.location.state}
          </p>
          <p className="mt-4 text-lg font-semibold text-slate-950">{formatPrice(listing.price)}</p>
          <p className="mt-6 text-sm leading-7 text-slate-700">{listing.description}</p>
        </div>
      </div>
      <aside className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Contact agent</p>
        <div className="mt-4 space-y-3">
          <a
            href={`tel:${listing.contactPhone}`}
            className="flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
          >
            Call {listing.contactPhone}
          </a>
          <a
            href={whatsappLink(listing.contactWhatsapp, listing.title)}
            className="flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white"
          >
            Chat on WhatsApp
          </a>
        </div>
        <dl className="mt-6 space-y-4 text-sm text-slate-600">
          <div className="flex justify-between gap-4">
            <dt>Type</dt>
            <dd className="font-medium text-slate-950">{listing.propertyType}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd className="font-medium capitalize text-slate-950">{listing.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Updated</dt>
            <dd className="font-medium text-slate-950">{formatDate(listing.updatedAt)}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}
