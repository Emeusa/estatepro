"use client";

import { useState } from "react";

type Props = {
  phone: string;
  title: string;
  whatsappHref: string;
};

export function ListingContactActions({ phone, title, whatsappHref }: Props) {
  const [message, setMessage] = useState("");

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

  return (
    <>
      <button
        className="mt-3 hidden w-full items-center justify-center rounded-2xl border border-slate-300 bg-white/55 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-white/80 lg:flex"
        type="button"
        onClick={shareListing}
      >
        Share listing
      </button>
      {message ? <p className="mt-2 text-center text-xs font-semibold text-slate-500">{message}</p> : null}
      <div className="h-20 lg:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          <a
            href={`tel:${phone}`}
            className="flex items-center justify-center rounded-2xl bg-slate-950 px-3 py-3 text-sm font-bold text-white"
          >
            Call
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white"
          >
            WhatsApp
          </a>
          <button
            className="flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-800"
            type="button"
            onClick={shareListing}
          >
            Share
          </button>
          {message ? (
            <p className="col-span-3 text-center text-xs font-semibold text-slate-500">{message}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
