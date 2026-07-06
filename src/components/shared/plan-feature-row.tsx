"use client";

import { useId, useState } from "react";

import { PlanFeatureDisplayRow } from "@/lib/pricing";

type Props = {
  feature: PlanFeatureDisplayRow;
};

export function PlanFeatureRow({ feature }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();
  const isUnavailable = feature.value.toLowerCase().includes("not included");

  return (
    <div
      className="relative rounded-xl bg-white/55 px-3 py-2 text-xs ring-1 ring-slate-200/80"
      onBlur={(event) => {
        const nextFocused = event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (!event.currentTarget.contains(nextFocused)) {
          setIsOpen(false);
        }
      }}
      onFocus={() => setIsOpen(true)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 font-bold text-slate-700">
          <span>{feature.label}</span>
          <button
            aria-describedby={isOpen ? tooltipId : undefined}
            aria-expanded={isOpen}
            aria-label={`Explain ${feature.label}`}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[11px] font-black text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setIsOpen(true)}
            onPointerDown={(event) => {
              if (event.pointerType !== "mouse") {
                event.preventDefault();
                setIsOpen((current) => !current);
              }
            }}
            type="button"
          >
            ?
          </button>
        </span>
        <span className={`text-right font-extrabold ${isUnavailable ? "text-slate-400" : "text-slate-950"}`}>
          {feature.value}
        </span>
      </div>

      {isOpen ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-semibold leading-5 text-white shadow-xl ring-1 ring-slate-700"
          id={tooltipId}
          role="tooltip"
        >
          {feature.helpText}
        </div>
      ) : null}
    </div>
  );
}
