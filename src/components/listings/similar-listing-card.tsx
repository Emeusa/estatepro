import Link from "next/link";

import { SafeListingImage } from "@/components/listings/safe-listing-image";
import { formatPrice } from "@/lib/format";
import { getListingHeroImage } from "@/lib/listing-images";
import { LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { PROPERTY_SUBTYPE_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/property-taxonomy";
import { getListingHref } from "@/lib/listing-urls";
import { PublicListingCardRecord } from "@/lib/types";

type Props = {
  listing: PublicListingCardRecord;
};

export function SimilarListingCard({ listing }: Props) {
  const image = getListingHeroImage(listing);
  const listingHref = getListingHref(listing);

  return (
    <Link
      href={listingHref}
      className="group grid grid-cols-[7rem_1fr] gap-3 rounded-2xl border border-white/60 bg-white/65 p-2 shadow-sm transition hover:bg-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 sm:block"
    >
      <div className="relative h-24 overflow-hidden rounded-xl bg-stone-200 sm:h-28">
        {image ? (
          <SafeListingImage
            src={image.cardUrl}
            alt={listing.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 112px, 220px"
            quality={70}
            {...(image.blurDataUrl ? { placeholder: "blur" as const, blurDataURL: image.blurDataUrl } : {})}
          />
        ) : null}
      </div>
      <div className="min-w-0 py-1 sm:pt-3">
        <p className="line-clamp-2 text-sm font-bold text-slate-950">{listing.title}</p>
        <p className="mt-1 truncate text-xs text-slate-600">
          {listing.location.area}, {listing.location.city}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[0.65rem] font-bold text-amber-900">
            {LISTING_CATEGORY_LABELS[listing.listingCategory]}
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[0.65rem] font-bold capitalize text-emerald-800">
            {listing.propertySubtype
              ? PROPERTY_SUBTYPE_LABELS[listing.propertySubtype]
              : PROPERTY_TYPE_LABELS[listing.propertyType]}
          </span>
        </div>
        <p className="mt-2 text-sm font-black text-slate-950">{formatPrice(listing.price)}</p>
      </div>
    </Link>
  );
}
