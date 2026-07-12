"use client";

import { useEffect, useState } from "react";

import { FilterBar, FilterBarProps } from "@/components/listings/filter-bar";

type Props = Omit<FilterBarProps, "variant"> & {
  anchorId: string;
  deferUntilElementId?: string;
};

export function StickyListingFilter({ anchorId, deferUntilElementId, ...filterProps }: Props) {
  const [anchorVisible, setAnchorVisible] = useState(true);
  const [deferredElementVisible, setDeferredElementVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const anchor = document.getElementById(anchorId);
    if (!anchor || typeof IntersectionObserver === "undefined") {
      setAnchorVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = Boolean(entry?.isIntersecting);
        setAnchorVisible(isVisible);
        if (isVisible) {
          setOpen(false);
        }
      },
      { rootMargin: "-80px 0px 0px 0px", threshold: 0.05 }
    );

    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchorId]);

  useEffect(() => {
    if (!deferUntilElementId) {
      setDeferredElementVisible(false);
      return;
    }

    const deferredElement = document.getElementById(deferUntilElementId);
    if (!deferredElement || typeof IntersectionObserver === "undefined") {
      setDeferredElementVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = Boolean(entry?.isIntersecting);
        setDeferredElementVisible(isVisible);
        if (isVisible) {
          setOpen(false);
        }
      },
      { rootMargin: "-80px 0px 0px 0px", threshold: 0.05 }
    );

    observer.observe(deferredElement);
    return () => observer.disconnect();
  }, [deferUntilElementId]);

  if (anchorVisible || deferredElementVisible) {
    return null;
  }

  return (
    <div className="fixed right-4 top-24 z-40 hidden lg:block">
      {open ? (
        <div className="w-80 overflow-hidden rounded-[1.65rem] border border-white/40 bg-white/95 p-3 shadow-2xl shadow-slate-950/20 backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Search</p>
              <p className="text-sm font-black text-slate-950">Refine listings</p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
              aria-label="Close search panel"
              onClick={() => setOpen(false)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2.4]">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">
            <FilterBar {...filterProps} variant="side" />
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="group inline-flex items-center gap-2 rounded-full border border-white/50 bg-[#0f877f] px-4 py-3 text-sm font-black text-white shadow-2xl shadow-teal-950/25 transition hover:-translate-y-0.5 hover:bg-[#0d766f]"
          onClick={() => setOpen(true)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2.3]">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          Search
        </button>
      )}
    </div>
  );
}
