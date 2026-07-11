"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { formatPrice, whatsappLink } from "@/lib/format";
import { trackListingEvent } from "@/lib/listing-events";
import { getListingImages } from "@/lib/listing-images";
import { getListingPromotionBadge } from "@/lib/listing-visibility";
import { getUnavailableBadge, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { getListingQualityBadges } from "@/lib/listing-quality";
import { PublicListingCardRecord } from "@/lib/types";
import { VerifiedBadgeIcon } from "@/components/agents/verified-badge";
import { getQualityIconForLabel, QualityIcon } from "@/components/listings/listing-quality-icons";
import { SaveListingButton } from "@/components/listings/save-listing-button";

type Props = {
  listing: PublicListingCardRecord;
  initialSaved?: boolean;
  onSavedChange?: (listingId: string, saved: boolean) => void;
};

function getCardImageRatio(image: ReturnType<typeof getListingImages>[number] | undefined) {
  return image?.cardWidth && image.cardHeight ? image.cardWidth / image.cardHeight : 4 / 3;
}

function ListingPromotionBadge({ label }: { label: string }) {
  if (label === "Sponsored") {
    return (
      <span
        aria-label="Sponsored listing"
        title="Sponsored placement"
        className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-amber-300 drop-shadow-[0_1px_2px_rgba(15,23,42,0.95)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M12 2.2 19.2 5v5.4c0 4.6-2.9 8.8-7.2 11.4-4.3-2.6-7.2-6.8-7.2-11.4V5L12 2.2Zm0 4.05-.95 2.95H7.94l2.52 1.82-.96 2.93L12 12.13l2.5 1.82-.96-2.93 2.52-1.82h-3.11L12 6.25Z" />
        </svg>
        Sponsored
      </span>
    );
  }

  return (
    <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-amber-100 drop-shadow-[0_1px_2px_rgba(15,23,42,0.95)]">
      {label}
    </span>
  );
}

function VerifiedAgentBadge({ agentName }: { agentName: string | null }) {
  return (
    <span
      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.07em] text-slate-800 shadow-sm ring-1 ring-emerald-200"
      title={agentName ? `Verified agent: ${agentName}` : "Verified agent"}
      aria-label={agentName ? `Verified agent ${agentName}` : "Verified agent"}
    >
      <VerifiedBadgeIcon className="h-4 w-4 ring-1 ring-white" />
      <span className="truncate text-emerald-800">{agentName ?? "Verified agent"}</span>
    </span>
  );
}

export function ListingCard({ listing, initialSaved, onSavedChange }: Props) {
  const unavailableBadge = getUnavailableBadge(listing);
  const qualityBadges = getListingQualityBadges(listing).slice(0, 4);
  const images = getListingImages(listing);
  const image = images[0];
  const previewImages = images.slice(1, 4);
  const [previewRatios, setPreviewRatios] = useState<Record<number, number>>({});
  const promotionBadge = getListingPromotionBadge(listing);
  const listingHref = `/listings/${listing.id}`;
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = cardRef.current;
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

  useEffect(() => {
    setPreviewRatios({});
  }, [image?.cardUrl]);

  function rememberPreviewRatio(index: number, element: HTMLImageElement) {
    if (!element.naturalWidth || !element.naturalHeight) {
      return;
    }
    const ratio = element.naturalWidth / element.naturalHeight;
    setPreviewRatios((current) => (current[index] === ratio ? current : { ...current, [index]: ratio }));
  }

  return (
    <article ref={cardRef} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-48 w-full overflow-hidden sm:h-52 lg:h-48 xl:h-52">
        <Link href={listingHref} aria-label={`View ${listing.title}`} className="group relative block h-full">
          {image ? (
            <Image
              src={image.cardUrl}
              alt={listing.title}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.02] group-hover:opacity-95"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px"
              quality={70}
              unoptimized={image.isPreprocessed}
            />
          ) : null}
          {images.length > 1 ? (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                <path d="M7 5.5 8.4 4h7.2L17 5.5h2.5A2.5 2.5 0 0 1 22 8v9a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17V8a2.5 2.5 0 0 1 2.5-2.5H7Zm5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-1.8a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
              </svg>
              {images.length}
            </span>
          ) : null}
          {unavailableBadge ? (
            <span className="absolute left-3 top-14 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              {unavailableBadge}
            </span>
          ) : null}
          {promotionBadge ? <ListingPromotionBadge label={promotionBadge} /> : null}
        </Link>
        <SaveListingButton
          listingId={listing.id}
          initialSaved={initialSaved}
          onSavedChange={(saved) => onSavedChange?.(listing.id, saved)}
          className="absolute left-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:scale-105 hover:text-rose-600 disabled:cursor-wait disabled:opacity-70"
        />
      </div>
      {previewImages.length ? (
        <div className="flex min-w-0 max-w-full items-start gap-2 overflow-hidden bg-white px-3 pt-3">
          {previewImages.map((preview, index) => (
            <Link
              key={`${preview.cardUrl}-${index}`}
              href={listingHref}
              aria-label={`View photo ${index + 2} for ${listing.title}`}
              className="group relative h-12 max-w-full shrink-0 overflow-hidden rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              style={{ aspectRatio: previewRatios[index] ?? getCardImageRatio(preview) }}
            >
              <Image
                src={preview.cardUrl}
                alt={listing.title}
                fill
                className="object-cover transition duration-300 group-hover:scale-[1.03] group-hover:opacity-95"
                sizes="120px"
                quality={70}
                unoptimized={preview.isPreprocessed}
                onLoad={(event) => rememberPreviewRatio(index, event.currentTarget)}
              />
            </Link>
          ))}
        </div>
      ) : null}
      <div className="p-3.5">
        <Link
          href={listingHref}
          className="block rounded-2xl transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-[0.98rem] font-black leading-snug text-slate-950">{listing.title}</h3>
            <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[0.68rem] font-bold text-amber-700">
              {LISTING_CATEGORY_LABELS[listing.listingCategory]}
            </span>
          </div>
          <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-slate-500">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current">
              <path d="M12 2.25A7.25 7.25 0 0 0 4.75 9.5c0 4.74 5.33 10.22 6.43 11.29a1.16 1.16 0 0 0 1.64 0c1.1-1.07 6.43-6.55 6.43-11.29A7.25 7.25 0 0 0 12 2.25Zm0 9.75a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
            </svg>
            <span className="line-clamp-1">
              {listing.location.area}, {listing.location.city}
            </span>
          </p>
          {listing.descriptionPreview ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-700">{listing.descriptionPreview}</p>
          ) : null}
          {qualityBadges.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {qualityBadges.map((badge) => (
                <span key={badge} className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.68rem] font-bold text-slate-700">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
          {listing.cardFeatureBadges.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {listing.cardFeatureBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.06em] text-blue-700"
                >
                  <QualityIcon icon={getQualityIconForLabel(badge)} className="h-3 w-3 shrink-0 text-blue-700" />
                  <span className="truncate">{badge}</span>
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-base font-black text-slate-950">{formatPrice(listing.price)}</p>
          {listing.agentIsVerified ? <VerifiedAgentBadge agentName={listing.agentName} /> : null}
        </Link>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
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
