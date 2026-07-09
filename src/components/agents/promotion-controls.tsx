"use client";

import { AgentEntitlements, ListingRecord } from "@/lib/types";

type PromotionType = "boost" | "featured" | "sponsored";

type Props = {
  listing: ListingRecord;
  entitlements?: AgentEntitlements;
  busyPromotion?: PromotionType | null;
  onPromote: (promotionType: PromotionType) => void;
};

const ACTIONS: Array<{ type: PromotionType; label: string; credit: keyof AgentEntitlements["credits"] }> = [
  { type: "boost", label: "Boost", credit: "boost" },
  { type: "featured", label: "Feature", credit: "featured" },
  { type: "sponsored", label: "Sponsor", credit: "sponsored" }
];

function disabledReason(listing: ListingRecord, entitlements: AgentEntitlements | undefined, credit: keyof AgentEntitlements["credits"]) {
  if (!entitlements) {
    return "Plan data unavailable";
  }
  if (listing.status !== "active") {
    return "Active listings only";
  }
  if (listing.availability !== "available") {
    return "Available listings only";
  }
  if (entitlements.credits[credit].remaining <= 0) {
    return "No credits left";
  }
  return null;
}

export function PromotionControls({ listing, entitlements, busyPromotion, onPromote }: Props) {
  return (
    <div className="mt-3 rounded-2xl bg-slate-200/70 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Promote</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {ACTIONS.map((action) => {
          const reason = disabledReason(listing, entitlements, action.credit);
          const isBusy = busyPromotion === action.type;
          return (
            <button
              key={action.type}
              className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-300 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              disabled={Boolean(reason) || Boolean(busyPromotion)}
              onClick={() => onPromote(action.type)}
              title={reason ?? `${entitlements?.credits[action.credit].remaining ?? 0} credits remaining`}
              type="button"
            >
              {isBusy ? "Applying..." : action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
