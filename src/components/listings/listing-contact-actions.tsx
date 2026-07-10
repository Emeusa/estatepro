"use client";

import { useEffect, useRef, useState } from "react";

import { trackListingEvent } from "@/lib/listing-events";

type Props = {
  listingId: string;
  phone: string;
  title: string;
  whatsappHref: string;
};

export function ListingContactActions({ listingId, phone, title, whatsappHref }: Props) {
  const [message, setMessage] = useState("");
  const [inlineVisible, setInlineVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
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
    const inlineNode = inlineActionsRef.current;
    if (!inlineNode || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInlineVisible(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.1 }
    );

    observer.observe(inlineNode);
    return () => observer.disconnect();
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

  const showStickyActions = !inlineVisible && !footerVisible;

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
          Call {phone}
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
      {showStickyActions ? (
        <>
          <div className="h-16 lg:hidden" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur lg:hidden [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
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
        </>
      ) : null}
    </>
  );
}
