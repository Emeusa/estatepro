"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { formatPrice } from "@/lib/format";
import { shouldOptimizeListingImage } from "@/lib/listing-image-optimization";
import { trackListingEvent } from "@/lib/listing-events";
import { SaveListingButton } from "@/components/listings/save-listing-button";

type Props = {
  listingId: string;
  phone: string;
  title: string;
  whatsappHref: string;
  price: number;
  locationText: string;
  thumbnailUrl?: string | null;
};

export function ListingContactActions({
  listingId,
  phone,
  title,
  whatsappHref,
  price,
  locationText,
  thumbnailUrl
}: Props) {
  const [message, setMessage] = useState("");
  const [inlineVisible, setInlineVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const inlineActionsRef = useRef<HTMLDivElement | null>(null);

  async function shareListing() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      setMessage("Listing link copied.");
    } catch {
      setMessage("Could not share this listing.");
    }
  }

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    const inlineNode = inlineActionsRef.current;
    if (!inlineNode) {
      return;
    }

    const updateInlineVisibility = () => {
      const rect = inlineNode.getBoundingClientRect();
      setInlineVisible(rect.bottom > 0 && rect.top < window.innerHeight);
    };

    updateInlineVisibility();
    window.addEventListener("scroll", updateInlineVisibility, { passive: true });
    window.addEventListener("resize", updateInlineVisibility);

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          setInlineVisible(Boolean(entry?.isIntersecting));
        },
        { threshold: 0.1 }
      );
      observer.observe(inlineNode);
    }

    return () => {
      window.removeEventListener("scroll", updateInlineVisibility);
      window.removeEventListener("resize", updateInlineVisibility);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const footerNode = document.getElementById("site-footer");
    if (!footerNode || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setFooterVisible(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.01 }
    );

    observer.observe(footerNode);
    return () => observer.disconnect();
  }, []);

  const showDesktopStickyActions = !inlineVisible;
  const showMobileStickyActions = !inlineVisible && !footerVisible;

  const desktopStickyBar = showDesktopStickyActions ? (
    <div
      className="fixed inset-x-0 top-0 z-40 hidden border-b border-slate-200 bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:flex"
      data-listing-sticky-contact="desktop"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
                quality={70}
                unoptimized={!shouldOptimizeListingImage(thumbnailUrl)}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-slate-400">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M4.5 4.5h15A2.5 2.5 0 0 1 22 7v10a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17V7a2.5 2.5 0 0 1 2.5-2.5Zm1.3 12.8h12.4l-4-5.34-3.05 3.58-2.1-2.5-3.25 4.26Z" />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-5 text-slate-950">{title}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{locationText}</p>
          </div>
        </div>
        <p className="shrink-0 border-l border-slate-200 pl-5 text-lg font-black text-slate-950">
          {formatPrice(price)}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <SaveListingButton listingId={listingId} />
          <button
            type="button"
            aria-label="Share listing"
            title="Share listing"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            onClick={shareListing}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a3 3 0 1 0-2.8-4H15a3 3 0 0 0 .6 1.8l-7.1 4.1a3 3 0 0 0-2.5-1.4 3 3 0 1 0 2.5 4.6l7.1 4.1A3 3 0 1 0 18 16a3 3 0 0 0-1.6.45l-7.1-4.1a3.2 3.2 0 0 0 0-.7l7.1-4.1A3 3 0 0 0 18 8Z" />
            </svg>
          </button>
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            onClick={() => trackListingEvent(listingId, "phone_click")}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M6.62 10.79a15.1 15.1 0 0 0 6.59 6.59l2.2-2.2a1.1 1.1 0 0 1 1.12-.27 12.6 12.6 0 0 0 3.95.63 1.1 1.1 0 0 1 1.1 1.1v3.5a1.1 1.1 0 0 1-1.1 1.1A18.7 18.7 0 0 1 1.76 2.52a1.1 1.1 0 0 1 1.1-1.1h3.5a1.1 1.1 0 0 1 1.1 1.1 12.6 12.6 0 0 0 .63 3.95 1.1 1.1 0 0 1-.27 1.12l-2.2 2.2Z" />
            </svg>
            Call agent
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
            onClick={() => trackListingEvent(listingId, "whatsapp_click")}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M12.04 2.25a9.54 9.54 0 0 0-8.16 14.49L2.75 21.75l5.14-1.07A9.54 9.54 0 1 0 12.04 2.25Zm0 1.75a7.79 7.79 0 0 1 6.63 11.9 7.79 7.79 0 0 1-9.98 2.91l-.28-.14-3.36.7.74-3.25-.17-.3A7.79 7.79 0 0 1 12.04 4Zm-3.2 3.87c-.18 0-.46.07-.7.34-.24.27-.92.9-.92 2.2 0 1.29.94 2.54 1.07 2.71.13.18 1.82 2.9 4.5 3.95 2.23.88 2.69.7 3.17.66.49-.04 1.57-.64 1.8-1.26.22-.62.22-1.15.15-1.26-.07-.11-.25-.18-.53-.32-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.27-.71.9-.87 1.08-.16.18-.32.2-.6.07-.28-.14-1.17-.43-2.23-1.38-.82-.73-1.38-1.64-1.54-1.91-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.04-.34-.02-.48-.07-.14-.62-1.49-.85-2.03-.22-.54-.45-.46-.62-.47h-.53Z" />
            </svg>
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  ) : null;

  const mobileStickyBar = showMobileStickyActions ? (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur lg:hidden [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]"
      data-listing-sticky-contact="mobile"
    >
      <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
        <a
          href={`tel:${phone}`}
          className="flex items-center justify-center rounded-2xl bg-slate-950 px-3 py-3 text-sm font-black text-white"
          onClick={() => trackListingEvent(listingId, "phone_click")}
        >
          Call
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-black text-white"
          onClick={() => trackListingEvent(listingId, "whatsapp_click")}
        >
          WhatsApp
        </a>
      </div>
    </div>
  ) : null;

  const stickyPortal = portalRoot ? createPortal(<>{desktopStickyBar}{mobileStickyBar}</>, portalRoot) : null;

  return (
    <>
      <div ref={inlineActionsRef} className="space-y-3">
        <a
          href={`tel:${phone}`}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
          onClick={() => trackListingEvent(listingId, "phone_click")}
        >
          Call agent
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
          onClick={() => trackListingEvent(listingId, "whatsapp_click")}
        >
          Chat on WhatsApp
        </a>
        <button
          className="flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white/55 px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-white/80"
          type="button"
          onClick={shareListing}
        >
          Share listing
        </button>
      </div>
      {message ? <p className="mt-2 text-center text-xs font-semibold text-slate-500">{message}</p> : null}
      {stickyPortal}
    </>
  );
}
