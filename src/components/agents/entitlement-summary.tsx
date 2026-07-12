"use client";

import { AgentEntitlements } from "@/lib/types";

type Props = {
  entitlements?: AgentEntitlements;
};

export function EntitlementSummary({ entitlements }: Props) {
  if (!entitlements) {
    return null;
  }

  const credits = [
    { label: "Boosts", value: entitlements.credits.boost },
    { label: "Sponsored", value: entitlements.credits.featured },
    { label: "Premium", value: entitlements.credits.sponsored }
  ];

  return (
    <section className="px-3 sm:px-6">
      <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Plan usage</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{entitlements.planName}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {entitlements.activeListingCount} of {entitlements.activeListingLimit} active available listings used.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Auto refresh: {entitlements.autoRefreshDays ? `Every ${entitlements.autoRefreshDays} days` : "Not included"}
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {credits.map((credit) => (
            <div key={credit.label} className="rounded-2xl bg-slate-300/60 p-3">
              <p className="text-xs font-bold text-slate-500">{credit.label}</p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {credit.value.remaining}
                <span className="text-sm font-semibold text-slate-500"> / {credit.value.quantity}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
