"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AdminIdentityCard, AdminShell } from "@/components/admin/admin-shell";
import { PaginationNav } from "@/components/listings/pagination-nav";
import { apiRequest } from "@/lib/api";
import { LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { NIGERIA_STATES } from "@/lib/nigeria-locations";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-taxonomy";
import { supabase } from "@/lib/supabase/client";
import type {
  AdminListingRankingRecord,
  AdminListingRankingResponse,
  ListingCategory,
  PropertyType,
  UserRecord
} from "@/lib/types";

const categoryValues: ListingCategory[] = ["for_sale", "for_rent", "short_let"];
const propertyTypeValues: PropertyType[] = ["apartment", "house", "room", "land", "commercial"];

function promotionTone(tier: AdminListingRankingRecord["promotionTier"]) {
  if (tier === "premium") return "bg-amber-100 text-amber-800";
  if (tier === "sponsored") return "bg-blue-100 text-blue-800";
  return "bg-slate-300 text-slate-700";
}

function freshnessLabel(source: AdminListingRankingRecord["freshnessSource"]) {
  if (source === "boost") return "Boost";
  if (source === "plan_refresh") return "Plan refresh";
  return "New listing";
}

function diversityLabel(adjustments: AdminListingRankingRecord["diversityAdjustments"]) {
  if (!adjustments.length) return "None";
  return adjustments
    .map((adjustment) => {
      if (adjustment === "page_limit") return "Agent page limit";
      if (adjustment === "consecutive_limit") return "Consecutive limit";
      return "Low-inventory relaxation";
    })
    .join(", ");
}

export default function AdminRankingPage() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [ranking, setRanking] = useState<AdminListingRankingResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadRanking() {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        window.location.assign("/login?next=/admin/ranking");
        return;
      }

      try {
        setLoading(true);
        setError("");
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [me, result] = await Promise.all([
          apiRequest<{ user: UserRecord }>("/api/auth/me", { headers }),
          apiRequest<AdminListingRankingResponse>(`/api/admin/ranking${queryString ? `?${queryString}` : ""}`, {
            headers
          })
        ]);
        if (!active) return;
        setAccount(me.user);
        setRanking(result);
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Could not load listing ranking.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRanking();
    return () => {
      active = false;
    };
  }, [queryString]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["state", "listingCategory", "propertyType"] as const) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    window.location.assign(`/admin/ranking${params.size ? `?${params.toString()}` : ""}`);
  }

  const adminName = account?.fullName ?? "Admin";
  const adminEmail = account?.email ?? "";
  const queryParams = {
    state: searchParams.get("state") ?? undefined,
    listingCategory: searchParams.get("listingCategory") ?? undefined,
    propertyType: searchParams.get("propertyType") ?? undefined
  };

  return (
    <AdminShell active="ranking" adminName={adminName} adminEmail={adminEmail}>
      <div className="space-y-5 p-3 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Public result audit</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Listing ranking</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              This is the same 60-second ranking snapshot used by public results. Premium positions are global; scores
              explain quality, freshness, and paid advantage.
            </p>
          </div>
          <AdminIdentityCard adminName={adminName} adminEmail={adminEmail} />
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-200 p-4">
            <p className="text-lg font-black text-slate-950">60% quality</p>
            <p className="mt-1 text-sm text-slate-600">Photos and complete property information.</p>
          </div>
          <div className="rounded-2xl bg-slate-200 p-4">
            <p className="text-lg font-black text-slate-950">40% freshness</p>
            <p className="mt-1 text-sm text-slate-600">Creation, Boost, or the latest plan refresh.</p>
          </div>
          <div className="rounded-2xl bg-slate-200 p-4">
            <p className="text-lg font-black text-slate-950">Paid advantage</p>
            <p className="mt-1 text-sm text-slate-600">Premium +30, Sponsored +20, with Premium slots 1, 5, and 9.</p>
          </div>
        </section>

        <form onSubmit={applyFilters} className="grid gap-3 rounded-2xl bg-slate-200 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <label className="text-xs font-black uppercase tracking-wider text-slate-600">
            State
            <select name="state" defaultValue={queryParams.state ?? ""} className="input mt-2 normal-case tracking-normal">
              <option value="">All states</option>
              {NIGERIA_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-wider text-slate-600">
            Category
            <select name="listingCategory" defaultValue={queryParams.listingCategory ?? ""} className="input mt-2 normal-case tracking-normal">
              <option value="">All categories</option>
              {categoryValues.map((category) => (
                <option key={category} value={category}>{LISTING_CATEGORY_LABELS[category]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-wider text-slate-600">
            Property group
            <select name="propertyType" defaultValue={queryParams.propertyType ?? ""} className="input mt-2 normal-case tracking-normal">
              <option value="">All property groups</option>
              {propertyTypeValues.map((propertyType) => (
                <option key={propertyType} value={propertyType}>{PROPERTY_TYPE_LABELS[propertyType]}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">
            Inspect ranking
          </button>
        </form>

        {ranking?.snapshotAt ? (
          <p className="text-xs font-semibold text-slate-500">
            Snapshot generated {new Date(ranking.snapshotAt).toLocaleString()}
          </p>
        ) : null}
        {loading ? <p className="rounded-2xl bg-slate-200 p-5">Loading ranking snapshot...</p> : null}
        {error ? <p className="rounded-2xl bg-rose-100 p-5 font-semibold text-rose-700">{error}</p> : null}

        {!loading && !error && ranking ? (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-200">
              <table className="min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3">Position</th>
                    <th className="p-3">Listing</th>
                    <th className="p-3">Promotion</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Freshness</th>
                    <th className="p-3">Diversity</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.items.map((item) => (
                    <tr key={item.listingId} className="border-b border-slate-300/70 align-top">
                      <td className="p-3 text-xl font-black text-slate-950">#{item.position}</td>
                      <td className="max-w-sm p-3">
                        <Link href={`/listings/${item.slug}`} target="_blank" className="font-black text-blue-800 hover:underline">
                          {item.title}
                        </Link>
                        <p className="mt-1 text-xs text-slate-600">{item.agentName ?? "Approved agent"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[item.location.area, item.location.city, item.location.state].filter(Boolean).join(", ")}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black capitalize ${promotionTone(item.promotionTier)}`}>
                          {item.promotionTier}
                        </span>
                        {item.fixedPremiumSlot ? <p className="mt-2 text-xs font-bold text-amber-700">Fixed Premium slot</p> : null}
                        <p className="mt-2 text-xs text-slate-600">Bonus +{item.promotionBonus}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-lg font-black text-slate-950">{item.finalScore.toFixed(2)}</p>
                        <p className="mt-1 text-xs text-slate-600">Base {item.baseScore.toFixed(2)}</p>
                        <p className="mt-1 text-xs text-slate-500">Quality {item.qualityScore.toFixed(2)}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-950">{freshnessLabel(item.freshnessSource)}</p>
                        <p className="mt-1 text-xs text-slate-600">Score {item.freshnessScore.toFixed(2)}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(item.freshnessAt).toLocaleDateString()}</p>
                      </td>
                      <td className="max-w-xs p-3 text-xs text-slate-600">{diversityLabel(item.diversityAdjustments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!ranking.items.length ? <p className="p-6 text-sm text-slate-600">No public listings match these filters.</p> : null}
            </div>
            <PaginationNav
              {...ranking.pagination}
              basePath="/admin/ranking"
              queryParams={queryParams}
              itemLabel="ranked listings"
            />
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
