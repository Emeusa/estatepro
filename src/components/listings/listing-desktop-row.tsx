"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { VerifiedBadgeIcon } from "@/components/agents/verified-badge";
import { SaveListingButton } from "@/components/listings/save-listing-button";
import { getQualityIconForLabel, QualityIcon } from "@/components/listings/listing-quality-icons";
import { formatDate, formatPrice, whatsappLink } from "@/lib/format";
import { trackListingEvent } from "@/lib/listing-events";
import { getListingImages } from "@/lib/listing-images";
import { LISTING_CATEGORY_LABELS, getUnavailableBadge } from "@/lib/listing-labels";
import { getListingQualityBadges } from "@/lib/listing-quality";
import { getListingPromotionBadge } from "@/lib/listing-visibility";
import { PublicListingCardRecord } from "@/lib/types";

type Props = {
  listing: PublicListingCardRecord;
  initialSaved?: boolean;
  onSavedChange?: (listingId: string, saved: boolean) => void;
};

function PhotoCount({ count }: { count: number }) {
  if (count <= 1) {
    return null;
  }

  return (
    <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-slate-950/80 px-2 py-0.5 text-[0.68rem] font-bold text-white shadow-sm">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
        <path d="M7 5.5 8.4 4h7.2L17 5.5h2.5A2.5 2.5 0 0 1 22 8v9a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17V8a2.5 2.5 0 0 1 2.5-2.5H7Zm5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-1.8a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
      </svg>
      {count}
    </span>
  );
}

function PromotionBadge({ label }: { label: string }) {
  if (label === "Sponsored") {
    return (
      <span
        aria-label="Sponsored listing"
        title="Sponsored placement"
        className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.13em] text-amber-200 drop-shadow-[0_1px_2px_rgba(15,23,42,0.95)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
          <path d="M12 2.25 14.54 7.4l5.68.82-4.11 4 .97 5.65L12 15.2l-5.08 2.67.97-5.65-4.11-4 5.68-.82L12 2.25Zm0 4.25-1.36 2.75-3.03.44 2.19 2.13-.52 3.01L12 13.4l2.72 1.43-.52-3.01 2.19-2.13-3.03-.44L12 6.5Z" />
        </svg>
        Sponsored
      </span>
    );
  }

  if (label === "Premium") {
    return (
      <span
        aria-label="Premium listing"
        title="Premium placement"
        className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.13em] text-amber-300 drop-shadow-[0_1px_2px_rgba(15,23,42,0.95)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
          <path d="M12 2.2 19.2 5v5.4c0 4.6-2.9 8.8-7.2 11.4-4.3-2.6-7.2-6.8-7.2-11.4V5L12 2.2Zm0 4.05-.95 2.95H7.94l2.52 1.82-.96 2.93L12 12.13l2.5 1.82-.96-2.93 2.52-1.82h-3.11L12 6.25Z" />
        </svg>
        Premium
      </span>
    );
  }

  return (
    <span className="pointer-events-none absolute right-2.5 top-2.5 text-[0.62rem] font-black uppercase tracking-[0.13em] text-amber-100 drop-shadow-[0_1px_2px_rgba(15,23,42,0.95)]">
      {label}
    </span>
  );
}

function VerifiedAgentBadge({ agentName }: { agentName: string | null }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 text-[0.68rem] font-black uppercase tracking-[0.06em] text-emerald-800"
      title={agentName ? `Verified agent: ${agentName}` : "Verified agent"}
      aria-label={agentName ? `Verified agent ${agentName}` : "Verified agent"}
    >
      <VerifiedBadgeIcon className="h-4 w-4 shrink-0 ring-1 ring-white" />
      <span className="truncate">{agentName ?? "Verified agent"}</span>
    </span>
  );
}

export function ListingDesktopRow({ listing, initialSaved, onSavedChange }: Props) {
  const images = getListingImages(listing);
  const image = images[0];
  const previewImages = images.slice(1, 4);
  const listingHref = `/listings/${listing.id}`;
  const promotionBadge = getListingPromotionBadge(listing);
  const unavailableBadge = getUnavailableBadge(listing);
  const qualityBadges = getListingQualityBadges(listing).slice(0, 2);
  const featureBadges = listing.cardFeatureBadges.slice(0, 6);
  const rowRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = rowRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      return;
    }

    let tracked = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!tracked && entries.some((entry) => entry.isIntersecting)) {
          tracked = true;
          trackListingEvent(listing.id, "impression");
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [listing.id]);

  return (
    <article
      ref={rowRef}
      className="grid min-w-0 grid-cols-[286px_minmax(0,1fr)_172px] gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md 2xl:grid-cols-[304px_minmax(0,1fr)_184px] 2xl:gap-5"
    >
      <div className="min-w-0">
        <Link
          href={listingHref}
          aria-label={`View ${listing.title}`}
          className="group relative block h-[236px] overflow-hidden rounded-2xl bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 2xl:h-[250px]"
        >
          {image ? (
            <Image
              src={image.cardUrl}
              alt={listing.title}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.02] group-hover:opacity-95"
              sizes="(max-width: 1536px) 286px, 304px"
              quality={72}
              unoptimized={image.isPreprocessed}
            />
          ) : null}
          <PhotoCount count={images.length} />
          {unavailableBadge ? (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-[0.65rem] font-bold text-white shadow-sm">
              {unavailableBadge}
            </span>
          ) : null}
          {promotionBadge ? <PromotionBadge label={promotionBadge} /> : null}
        </Link>
        {previewImages.length ? (
          <div
            className={`mt-2 grid gap-2 ${
              previewImages.length === 1 ? "grid-cols-1" : previewImages.length === 2 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {previewImages.map((preview, index) => (
              <Link
                key={`${preview.cardUrl}-${index}`}
                href={listingHref}
                aria-label={`View photo ${index + 2} for ${listing.title}`}
                className="group relative h-16 overflow-hidden rounded-xl bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                <Image
                  src={preview.cardUrl}
                  alt={listing.title}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-[1.03] group-hover:opacity-95"
                  sizes="90px"
                  quality={68}
                  unoptimized={preview.isPreprocessed}
                />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col">
        <Link
          href={listingHref}
          className="block min-w-0 rounded-2xl p-1 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          <h3 className="line-clamp-3 text-lg font-black leading-snug text-slate-950">{listing.title}</h3>
          <p className="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs font-semibold text-slate-500">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current">
              <path d="M12 2.25A7.25 7.25 0 0 0 4.75 9.5c0 4.74 5.33 10.22 6.43 11.29a1.16 1.16 0 0 0 1.64 0c1.1-1.07 6.43-6.55 6.43-11.29A7.25 7.25 0 0 0 12 2.25Zm0 9.75a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
            </svg>
            <span className="truncate">
              {listing.location.area}, {listing.location.city}
            </span>
          </p>
          {listing.descriptionPreview ? (
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-700">{listing.descriptionPreview}</p>
          ) : null}
          {qualityBadges.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {qualityBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex min-w-0 max-w-full items-center rounded-full bg-slate-100 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.05em] text-slate-700"
                >
                  <span className="truncate">{badge}</span>
                </span>
              ))}
            </div>
          ) : null}
          {featureBadges.length ? (
            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
              {featureBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex min-w-0 max-w-[11rem] items-center gap-1 rounded-full bg-transparent px-0.5 py-0 text-[0.56rem] font-black uppercase tracking-[0.025em] text-slate-700"
                >
                  <QualityIcon icon={getQualityIconForLabel(badge)} className="h-2.5 w-2.5 shrink-0 text-slate-500" />
                  <span className="truncate">{badge}</span>
                </span>
              ))}
            </div>
          ) : null}
        </Link>
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 pt-4">
          {listing.agentIsVerified ? <VerifiedAgentBadge agentName={listing.agentName} /> : null}
          <span className="text-[0.7rem] font-semibold text-slate-500">Updated {formatDate(listing.updatedAt)}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col border-l border-slate-200 pl-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-base font-black leading-snug text-slate-950 2xl:text-lg">
              {formatPrice(listing.price)}
            </p>
            <p className="mt-1 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[0.68rem] font-bold text-amber-700">
              {LISTING_CATEGORY_LABELS[listing.listingCategory]}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SaveListingButton
              listingId={listing.id}
              initialSaved={initialSaved}
              onSavedChange={(saved) => onSavedChange?.(listing.id, saved)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:scale-105 hover:text-rose-600 disabled:cursor-wait disabled:opacity-70"
            />
          </div>
        </div>
        <div className="mt-auto grid grid-cols-[1fr_48px] gap-2 pt-4">
          <a
            href={`tel:${listing.contactPhone}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700"
            onClick={() => trackListingEvent(listing.id, "phone_click")}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M6.62 10.79a15.1 15.1 0 0 0 6.59 6.59l2.2-2.2a1.1 1.1 0 0 1 1.12-.27 12.6 12.6 0 0 0 3.95.63 1.1 1.1 0 0 1 1.1 1.1v3.5a1.1 1.1 0 0 1-1.1 1.1A18.7 18.7 0 0 1 1.76 2.52a1.1 1.1 0 0 1 1.1-1.1h3.5a1.1 1.1 0 0 1 1.1 1.1 12.6 12.6 0 0 0 .63 3.95 1.1 1.1 0 0 1-.27 1.12l-2.2 2.2Z" />
            </svg>
            Call
          </a>
          <a
            href={whatsappLink(listing.contactWhatsapp, listing.title)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Chat on WhatsApp about ${listing.title}`}
            className="inline-flex h-10 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white transition hover:bg-emerald-700"
            onClick={() => trackListingEvent(listing.id, "whatsapp_click")}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12.04 2.25a9.54 9.54 0 0 0-8.16 14.49L2.75 21.75l5.14-1.07A9.54 9.54 0 1 0 12.04 2.25Zm0 1.75a7.79 7.79 0 0 1 6.63 11.9 7.79 7.79 0 0 1-9.98 2.91l-.28-.14-3.36.7.74-3.25-.17-.3A7.79 7.79 0 0 1 12.04 4Zm-3.2 3.87c-.18 0-.46.07-.7.34-.24.27-.92.9-.92 2.2 0 1.29.94 2.54 1.07 2.71.13.18 1.82 2.9 4.5 3.95 2.23.88 2.69.7 3.17.66.49-.04 1.57-.64 1.8-1.26.22-.62.22-1.15.15-1.26-.07-.11-.25-.18-.53-.32-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.27-.71.9-.87 1.08-.16.18-.32.2-.6.07-.28-.14-1.17-.43-2.23-1.38-.82-.73-1.38-1.64-1.54-1.91-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.04-.34-.02-.48-.07-.14-.62-1.49-.85-2.03-.22-.54-.45-.46-.62-.47h-.53Z" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}
