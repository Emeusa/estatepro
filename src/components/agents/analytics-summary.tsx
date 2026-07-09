"use client";

import { AgentAnalyticsSummary } from "@/lib/types";

export function AnalyticsSummary({ analytics }: { analytics?: AgentAnalyticsSummary }) {
  if (!analytics || analytics.analyticsLevel === "none") {
    return null;
  }

  const stats = [
    { label: "Listing views", value: analytics.totals.listingViews },
    { label: "Detail views", value: analytics.totals.detailViews },
    { label: "WhatsApp clicks", value: analytics.totals.whatsappClicks },
    { label: "Phone clicks", value: analytics.totals.phoneClicks }
  ];

  return (
    <section className="px-3 sm:px-6">
      <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Analytics</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Last {analytics.range === "7d" ? "7" : "30"} days</h2>
          </div>
          <p className="text-xs font-semibold capitalize text-slate-500">{analytics.analyticsLevel} analytics</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-slate-300/60 p-3">
              <p className="text-xl font-black text-slate-950">{stat.value}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
        {analytics.analyticsLevel === "advanced" && analytics.listings.length ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Top listings</p>
            {analytics.listings.slice(0, 5).map((listing) => (
              <div key={listing.listingId} className="rounded-2xl bg-slate-300/60 p-3 text-sm">
                <p className="font-bold text-slate-950">{listing.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {listing.impressions} impressions · {listing.detailViews} views · {listing.whatsappClicks} WhatsApp ·{" "}
                  {listing.phoneClicks} calls
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
