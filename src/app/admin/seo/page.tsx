"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdminIdentityCard, AdminShell } from "@/components/admin/admin-shell";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import type { SeoMarketCoverageRecord, UserRecord } from "@/lib/types";

export default function AdminSeoPage() {
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [markets, setMarkets] = useState<SeoMarketCoverageRecord[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        window.location.assign("/login?next=/admin/seo");
        return;
      }
      try {
        const [me, coverage] = await Promise.all([
          apiRequest<{ user: UserRecord }>("/api/auth/me", { headers: { Authorization: `Bearer ${session.access_token}` } }),
          apiRequest<{ markets: SeoMarketCoverageRecord[]; generatedAt: string }>("/api/admin/seo", { headers: { Authorization: `Bearer ${session.access_token}` } })
        ]);
        if (!active) return;
        setAccount(me.user);
        setMarkets(coverage.markets);
        setGeneratedAt(coverage.generatedAt);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load SEO coverage.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => ({
    indexable: markets.filter((market) => market.isIndexable).length,
    growing: markets.filter((market) => !market.isIndexable).length,
    inventory: markets.reduce((sum, market) => sum + (market.pageType === "national" && market.path === "/properties" ? market.listingCount : 0), 0)
  }), [markets]);
  const adminName = account?.fullName ?? "Admin";
  const adminEmail = account?.email ?? "";

  return (
    <AdminShell active="seo" adminName={adminName} adminEmail={adminEmail}>
      <div className="space-y-5 p-3 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Nationwide organic coverage</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">SEO market coverage</h1>
            <p className="mt-1 text-sm text-slate-600">Inventory controls indexing automatically; empty and thin markets remain usable but noindex.</p>
          </div>
          <AdminIdentityCard adminName={adminName} adminEmail={adminEmail} />
        </div>
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-200 p-4"><p className="text-2xl font-black">{totals.inventory}</p><p className="text-sm text-slate-600">Active listings</p></div>
          <div className="rounded-2xl bg-emerald-100 p-4"><p className="text-2xl font-black text-emerald-800">{totals.indexable}</p><p className="text-sm text-emerald-700">Indexable markets</p></div>
          <div className="rounded-2xl bg-amber-100 p-4"><p className="text-2xl font-black text-amber-800">{totals.growing}</p><p className="text-sm text-amber-700">Growing/noindex markets</p></div>
        </section>
        {generatedAt ? <p className="text-xs font-semibold text-slate-500">Evaluated {new Date(generatedAt).toLocaleString()}</p> : null}
        {loading ? <p className="rounded-2xl bg-slate-200 p-5">Evaluating nationwide markets...</p> : null}
        {error ? <p className="rounded-2xl bg-rose-100 p-5 font-semibold text-rose-700">{error}</p> : null}
        {!loading && !error ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-3">Market</th><th className="p-3">Inventory</th><th className="p-3">Status</th><th className="p-3">Reason</th><th className="p-3">URL</th></tr></thead>
              <tbody>{markets.map((market) => <tr key={market.path} className="border-b border-slate-300/70 align-top"><td className="p-3 font-bold text-slate-950">{market.label}</td><td className="p-3">{market.listingCount}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${market.isIndexable ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{market.isIndexable ? market.isInGracePeriod ? "Grace" : "Index" : "Noindex"}</span></td><td className="max-w-sm p-3 text-slate-600">{market.reason}</td><td className="p-3"><Link href={market.path} target="_blank" className="font-bold text-blue-700 hover:underline">Open</Link></td></tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
