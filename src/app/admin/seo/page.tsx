"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdminIdentityCard, AdminShell } from "@/components/admin/admin-shell";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import type { SeoIndexingStatusRecord, SeoMarketCoverageRecord, UserRecord } from "@/lib/types";

export default function AdminSeoPage() {
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [markets, setMarkets] = useState<SeoMarketCoverageRecord[]>([]);
  const [indexing, setIndexing] = useState<SeoIndexingStatusRecord[]>([]);
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
          apiRequest<{ markets: SeoMarketCoverageRecord[]; indexing: SeoIndexingStatusRecord[]; generatedAt: string }>("/api/admin/seo", { headers: { Authorization: `Bearer ${session.access_token}` } })
        ]);
        if (!active) return;
        setAccount(me.user);
        setMarkets(coverage.markets);
        setIndexing(coverage.indexing);
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
    googleIndexed: indexing.filter((status) => status.googleIndexed).length,
    technicalIssues: indexing.filter((status) => status.technicalIssue).length,
    inventory: markets.reduce((sum, market) => sum + (market.pageType === "national" && market.path === "/properties" ? market.listingCount : 0), 0)
  }), [indexing, markets]);
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
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-slate-200 p-4"><p className="text-2xl font-black">{totals.inventory}</p><p className="text-sm text-slate-600">Active listings</p></div>
          <div className="rounded-2xl bg-emerald-100 p-4"><p className="text-2xl font-black text-emerald-800">{totals.indexable}</p><p className="text-sm text-emerald-700">Indexable markets</p></div>
          <div className="rounded-2xl bg-teal-100 p-4"><p className="text-2xl font-black text-teal-800">{totals.googleIndexed}</p><p className="text-sm text-teal-700">Google indexed</p></div>
          <div className="rounded-2xl bg-rose-100 p-4"><p className="text-2xl font-black text-rose-800">{totals.technicalIssues}</p><p className="text-sm text-rose-700">Technical issues</p></div>
          <div className="rounded-2xl bg-amber-100 p-4"><p className="text-2xl font-black text-amber-800">{totals.growing}</p><p className="text-sm text-amber-700">Growing/noindex markets</p></div>
        </section>
        {generatedAt ? <p className="text-xs font-semibold text-slate-500">Evaluated {new Date(generatedAt).toLocaleString()}</p> : null}
        {loading ? <p className="rounded-2xl bg-slate-200 p-5">Evaluating nationwide markets...</p> : null}
        {error ? <p className="rounded-2xl bg-rose-100 p-5 font-semibold text-rose-700">{error}</p> : null}
        {!loading && !error ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-3">Market</th><th className="p-3">Inventory</th><th className="p-3">Discovery</th><th className="p-3">Google</th><th className="p-3">Last check</th><th className="p-3">Reason</th><th className="p-3">URL</th></tr></thead>
              <tbody>{markets.map((market) => {
                const googleLabel = market.technicalIssue
                  ? "Technical issue"
                  : market.googleIndexed
                    ? "Indexed"
                    : market.lastInspectedAt
                      ? "Not indexed"
                      : "Awaiting check";
                const googleClass = market.technicalIssue
                  ? "bg-rose-100 text-rose-700"
                  : market.googleIndexed
                    ? "bg-teal-100 text-teal-700"
                    : "bg-slate-100 text-slate-600";
                return <tr key={market.path} className="border-b border-slate-300/70 align-top">
                  <td className="p-3 font-bold text-slate-950">{market.label}</td>
                  <td className="p-3">{market.listingCount}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${market.isIndexable ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {market.isIndexable ? market.isInGracePeriod ? "Grace" : market.inSitemap ? "In sitemap" : "Discoverable" : "Noindex"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-black ${googleClass}`}>{googleLabel}</span>
                    {market.googleCanonical && market.userCanonical && market.googleCanonical !== market.userCanonical ? (
                      <p className="mt-2 max-w-xs break-all text-xs text-rose-700">Google canonical: {market.googleCanonical}</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap p-3 text-xs text-slate-600">
                    {market.lastInspectedAt ? new Date(market.lastInspectedAt).toLocaleDateString() : "Not checked"}
                    {market.lastCrawlTime ? <p className="mt-1">Crawled {new Date(market.lastCrawlTime).toLocaleDateString()}</p> : null}
                  </td>
                  <td className="max-w-sm p-3 text-slate-600">{market.coverageState || market.reason}</td>
                  <td className="p-3"><Link href={market.path} target="_blank" className="font-bold text-blue-700 hover:underline">Open</Link></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : null}
        {!loading && !error ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Monitored canonical URLs</h2>
              <p className="text-sm text-slate-600">Eligible listings, markets, guides, and core pages scheduled for Search Console inspection.</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="p-3">URL</th><th className="p-3">Family</th><th className="p-3">Discovery</th><th className="p-3">Google</th><th className="p-3">Last crawl</th><th className="p-3">Canonical</th></tr>
                </thead>
                <tbody>{indexing.map((status) => {
                  const googleLabel = status.technicalIssue
                    ? "Technical issue"
                    : status.googleIndexed
                      ? "Indexed"
                      : status.lastInspectedAt
                        ? "Not indexed"
                        : "Awaiting check";
                  return <tr key={status.path} className="border-b border-slate-300/70 align-top">
                    <td className="max-w-md p-3"><Link href={status.path} target="_blank" className="break-all font-bold text-blue-700 hover:underline">{status.path}</Link></td>
                    <td className="p-3 capitalize">{status.pageFamily}</td>
                    <td className="p-3"><span className="whitespace-nowrap rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">{status.inSitemap ? "In sitemap" : "Discoverable"}</span></td>
                    <td className="p-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-black ${status.technicalIssue ? "bg-rose-100 text-rose-700" : status.googleIndexed ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-600"}`}>{googleLabel}</span>
                      {status.coverageState ? <p className="mt-2 max-w-xs text-xs text-slate-600">{status.coverageState}</p> : null}
                      {status.lastError ? <p className="mt-2 max-w-xs text-xs text-rose-700">{status.lastError}</p> : null}
                    </td>
                    <td className="whitespace-nowrap p-3 text-xs text-slate-600">{status.lastCrawlTime ? new Date(status.lastCrawlTime).toLocaleDateString() : "Not crawled"}</td>
                    <td className="max-w-xs break-all p-3 text-xs text-slate-600">{status.googleCanonical || status.userCanonical || "Not reported"}</td>
                  </tr>;
                })}</tbody>
              </table>
              {!indexing.length ? <p className="p-5 text-sm text-slate-600">Monitoring data appears after the Supabase schema and Search Console integration are configured.</p> : null}
            </div>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
