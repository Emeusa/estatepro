"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { VerifiedBadgeIcon } from "@/components/agents/verified-badge";
import { SafeListingImage } from "@/components/listings/safe-listing-image";
import { SaveListingButton } from "@/components/listings/save-listing-button";
import { getQualityIconForLabel, QualityIcon } from "@/components/listings/listing-quality-icons";
import { formatDate, formatPrice, whatsappLink } from "@/lib/format";
import { trackListingEvent } from "@/lib/listing-events";
import { getListingImages } from "@/lib/listing-images";
import { getUnavailableBadge, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { getListingQualityBadges } from "@/lib/listing-quality";
import { getListingHref } from "@/lib/listing-urls";
import { getListingPromotionBadge } from "@/lib/listing-visibility";
import type { PublicListingCardRecord } from "@/lib/types";

type Props = {
  listing: PublicListingCardRecord;
  initialSaved?: boolean;
  onSavedChange?: (listingId: string, saved: boolean) => void;
};

function PromotionBadge({ label }: { label: string }) {
  const premium = label === "Premium";
  return (
    <span
      className={`pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.13em] drop-shadow-[0_1px_2px_rgba(15,23,42,0.95)] ${
        premium ? "text-amber-300" : "text-amber-100"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        {premium ? (
          <path d="M12 2.2 19.2 5v5.4c0 4.6-2.9 8.8-7.2 11.4-4.3-2.6-7.2-6.8-7.2-11.4V5L12 2.2Zm0 4.05-.95 2.95H7.94l2.52 1.82-.96 2.93L12 12.13l2.5 1.82-.96-2.93 2.52-1.82h-3.11L12 6.25Z" />
        ) : (
          <path d="M12 2.25 14.54 7.4l5.68.82-4.11 4 .97 5.65L12 15.2l-5.08 2.67.97-5.65-4.11-4 5.68-.82L12 2.25Z" />
        )}
      </svg>
      {label}
    </span>
  );
}

export function ListingResult({ listing, initialSaved, onSavedChange }: Props) {
  const images = getListingImages(listing);
  const image = images[0];
  const previewImages = images.slice(1, 4);
  const photoCount = listing.imageCount ?? images.length;
  const href = getListingHref(listing);
  const promotionBadge = getListingPromotionBadge(listing);
  const unavailableBadge = getUnavailableBadge(listing);
  const qualityBadges = getListingQualityBadges(listing).slice(0, 3);
  const featureBadges = listing.cardFeatureBadges.slice(0, 6);
  const resultRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = resultRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
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
      ref={resultRef}
      className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md xl:grid xl:grid-cols-[286px_minmax(0,1fr)_172px] xl:gap-4 xl:p-4 2xl:grid-cols-[304px_minmax(0,1fr)_184px] 2xl:gap-5"
    >
      <div className="min-w-0">
        <Link
          href={href}
          aria-label={`View ${listing.title}`}
          className="group relative block h-52 overflow-hidden bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 sm:h-56 xl:h-[236px] xl:rounded-2xl 2xl:h-[250px]"
        >
          {image ? (
            <SafeListingImage
              src={image.cardUrl}
              alt={listing.title}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.02] group-hover:opacity-95"
              sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 304px"
              quality={70}
            />
          ) : null}
          {photoCount > 1 ? (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-white">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                <path d="M7 5.5 8.4 4h7.2L17 5.5h2.5A2.5 2.5 0 0 1 22 8v9a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17V8a2.5 2.5 0 0 1 2.5-2.5H7Zm5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              </svg>
              {photoCount}
            </span>
          ) : null}
          {promotionBadge ? <PromotionBadge label={promotionBadge} /> : null}
          {unavailableBadge ? (
            <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
              {unavailableBadge}
            </span>
          ) : null}
        </Link>
        {previewImages.length ? (
          <div className={`grid gap-2 p-3 pb-0 xl:mt-2 xl:p-0 ${previewImages.length === 1 ? "grid-cols-1" : previewImages.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {previewImages.map((preview, index) => (
              <Link
                key={`${preview.cardUrl}-${index}`}
                href={href}
                aria-label={`View photo ${index + 2} for ${listing.title}`}
                className="group relative h-14 overflow-hidden rounded-xl bg-slate-100 xl:h-16"
              >
                <SafeListingImage
                  src={preview.cardUrl}
                  alt={listing.title}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  sizes="120px"
                  quality={70}
                />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col p-4 xl:p-1">
        <Link href={href} className="block min-w-0 rounded-2xl transition hover:bg-slate-50">
          <h2 className="line-clamp-3 text-lg font-black leading-snug text-slate-950">{listing.title}</h2>
          <p className="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs font-semibold text-slate-500">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current">
              <path d="M12 2.25A7.25 7.25 0 0 0 4.75 9.5c0 4.74 5.33 10.22 6.43 11.29a1.16 1.16 0 0 0 1.64 0c1.1-1.07 6.43-6.55 6.43-11.29A7.25 7.25 0 0 0 12 2.25Zm0 9.75a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
            </svg>
            <span className="min-w-0 flex-1 whitespace-normal break-words leading-5 [overflow-wrap:anywhere]">
              {listing.location.area}, {listing.location.city}, {listing.location.state}
            </span>
          </p>
          {listing.descriptionPreview ? (
            <p className="mt-2 line-clamp-2 max-w-full break-words text-sm leading-5 text-slate-700 [overflow-wrap:anywhere]">
              {listing.descriptionPreview}
            </p>
          ) : null}
          {qualityBadges.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {qualityBadges.map((badge) => (
                <span key={badge} className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.04em] text-slate-700">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
          {featureBadges.length ? (
            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
              {featureBadges.map((badge, index) => (
                <span
                  key={badge}
                  className={`${index >= 3 ? "hidden sm:inline-flex" : "inline-flex"} max-w-[11rem] items-center gap-1 text-[0.58rem] font-black uppercase tracking-[0.025em] text-slate-700`}
                >
                  <QualityIcon icon={getQualityIconForLabel(badge)} className="h-2.5 w-2.5 shrink-0 text-slate-500" />
                  <span className="truncate">{badge}</span>
                </span>
              ))}
            </div>
          ) : null}
        </Link>
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 pt-4">
          {listing.agentIsVerified ? (
            <span className="inline-flex max-w-full items-center gap-1.5 text-[0.68rem] font-black uppercase tracking-[0.05em] text-emerald-800">
              <VerifiedBadgeIcon className="h-4 w-4 shrink-0 ring-1 ring-white" />
              <span className="truncate">{listing.agentName ?? "Verified agent"}</span>
            </span>
          ) : null}
          <span className="text-[0.7rem] font-semibold text-slate-500">Updated {formatDate(listing.updatedAt)}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col border-t border-slate-200 p-4 xl:border-l xl:border-t-0 xl:pl-4 xl:pr-0 xl:py-0">
        <p className="w-full whitespace-nowrap text-lg font-black leading-snug tracking-tight text-slate-950 xl:text-[0.95rem] 2xl:text-base">
          {formatPrice(listing.price)}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="inline-flex min-w-0 rounded-full bg-amber-50 px-2.5 py-1 text-[0.68rem] font-bold text-amber-700">
            {LISTING_CATEGORY_LABELS[listing.listingCategory]}
          </p>
          <SaveListingButton
            listingId={listing.id}
            initialSaved={initialSaved}
            onSavedChange={(saved) => onSavedChange?.(listing.id, saved)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-rose-600"
          />
        </div>
        <div className="mt-4 grid grid-cols-[1fr_48px] gap-2 xl:mt-auto xl:pt-4">
          <a
            href={`tel:${listing.contactPhone}`}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white hover:bg-blue-700"
            onClick={() => trackListingEvent(listing.id, "phone_click")}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-current">
              <path d="M6.62 10.79a15.1 15.1 0 0 0 6.59 6.59l2.2-2.2a1.1 1.1 0 0 1 1.12-.27 12.6 12.6 0 0 0 3.95.63 1.1 1.1 0 0 1 1.1 1.1v3.5a1.1 1.1 0 0 1-1.1 1.1A18.7 18.7 0 0 1 1.76 2.52a1.1 1.1 0 0 1 1.1-1.1h3.5a1.1 1.1 0 0 1 1.1 1.1 12.6 12.6 0 0 0 .63 3.95 1.1 1.1 0 0 1-.27 1.12l-2.2 2.2Z" />
            </svg>
            Call
          </a>
          <a
            href={whatsappLink(listing.contactWhatsapp, listing.title)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Chat on WhatsApp about ${listing.title}`}
            className="inline-flex h-10 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
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
