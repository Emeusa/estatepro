import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { getListingHeroImage } from "@/lib/listing-images";
import { getListingPromotionBadge } from "@/lib/listing-visibility";
import { getUnavailableBadge, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { getListingQualityBadges } from "@/lib/listing-quality";
import { ListingRecord } from "@/lib/types";

type Props = {
  listing: ListingRecord;
};

export function ListingCard({ listing }: Props) {
  const unavailableBadge = getUnavailableBadge(listing);
  const qualityBadges = getListingQualityBadges(listing).slice(0, 4);
  const image = getListingHeroImage(listing);
  const promotionBadge = getListingPromotionBadge(listing);
  const listingHref = `/listings/${listing.id}`;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <Link
        href={listingHref}
        aria-label={`View ${listing.title}`}
        className="group relative block h-52 bg-slate-100"
      >
        {image ? (
          <Image
            src={image.cardUrl}
            alt={listing.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px"
            quality={70}
            unoptimized={image.isPreprocessed}
            {...(image.blurDataUrl ? { placeholder: "blur" as const, blurDataURL: image.blurDataUrl } : {})}
          />
        ) : null}
        {unavailableBadge ? (
          <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            {unavailableBadge}
          </span>
        ) : null}
        {promotionBadge ? (
          <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-950 shadow-sm">
            {promotionBadge}
          </span>
        ) : null}
      </Link>
      <div className="p-4">
        <Link
          href={listingHref}
          className="block space-y-3 rounded-2xl transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">{listing.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {listing.location.area}, {listing.location.city}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Verified agent
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {LISTING_CATEGORY_LABELS[listing.listingCategory]}
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium capitalize text-emerald-700">
                {listing.propertyType}
              </span>
            </div>
          </div>
          {qualityBadges.length ? (
            <div className="flex flex-wrap gap-2">
              {qualityBadges.map((badge) => (
                <span key={badge} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-lg font-semibold text-slate-950">{formatPrice(listing.price)}</p>
        </Link>
        <Link
          href={listingHref}
          className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
