"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminIdentityCard, AdminShell, statusPillClass } from "@/components/admin/admin-shell";
import { ApiRequestError, apiRequest } from "@/lib/api";
import { REPORT_REASON_LABELS } from "@/lib/report-labels";
import { supabase } from "@/lib/supabase/client";
import { ListingReportRecord, UserRecord } from "@/lib/types";

type ReportsResponse = {
  reports: ListingReportRecord[];
};

type AdminAccount = {
  user: UserRecord | null;
};

const filterItems = [
  { label: "Open", value: "open" },
  { label: "Reviewing", value: "reviewing" },
  { label: "High risk", value: "high_risk" },
  { label: "Resolved", value: "resolved" },
  { label: "Dismissed", value: "dismissed" },
  { label: "All", value: "all" }
];

function severityClass(severity: ListingReportRecord["severity"]) {
  if (severity === "critical") return statusPillClass("red");
  if (severity === "high") return statusPillClass("amber");
  if (severity === "medium") return statusPillClass("green");
  return statusPillClass("slate");
}

function reportMatchesFilter(report: ListingReportRecord, status: string) {
  if (status === "all") {
    return true;
  }
  if (status === "high_risk") {
    return (
      (report.severity === "high" || report.severity === "critical") &&
      report.status !== "resolved" &&
      report.status !== "dismissed"
    );
  }
  return report.status === status;
}

export default function AdminReportsPage() {
  const [highlightedReportId] = useState(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("reportId")
  );
  const [reports, setReports] = useState<ListingReportRecord[]>([]);
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("open");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [agentMessage, setAgentMessage] = useState("");
  const [message, setMessage] = useState("Loading reports...");
  const [saving, setSaving] = useState(false);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId]
  );

  useEffect(() => {
    if (!selectedReport) {
      setAdminNotes("");
      setResolutionNotes("");
      setAgentMessage("");
      return;
    }
    setAdminNotes(selectedReport.adminNotes ?? "");
    setResolutionNotes(selectedReport.resolutionNotes ?? "");
    setAgentMessage("");
  }, [selectedReport]);

  const getToken = useCallback(async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const loadReports = useCallback(async (status = selectedStatus) => {
    const token = await getToken();
    if (!token) {
      setMessage("Log in with an admin account to continue.");
      return;
    }

    try {
      const [reportData, adminAccount] = await Promise.all([
        apiRequest<ReportsResponse>(`/api/admin/reports?status=${encodeURIComponent(status)}&limit=80`, {
          headers: { Authorization: `Bearer ${token}` },
          retries: 0
        }),
        apiRequest<AdminAccount>("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
          retries: 0
        })
      ]);
      let nextReports = reportData.reports;
      if (highlightedReportId && !nextReports.some((report) => report.id === highlightedReportId)) {
        const selected = await apiRequest<{ report: ListingReportRecord }>(`/api/admin/reports/${highlightedReportId}`, {
          headers: { Authorization: `Bearer ${token}` },
          retries: 0
        });
        nextReports = [selected.report, ...nextReports];
      }

      setReports(nextReports);
      setAccount(adminAccount.user);
      setSelectedReportId((current) =>
        highlightedReportId && nextReports.some((report) => report.id === highlightedReportId)
          ? highlightedReportId
          : current && nextReports.some((report) => report.id === current)
          ? current
          : nextReports[0]?.id ?? null
      );
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load reports.");
    }
  }, [getToken, highlightedReportId, selectedStatus]);

  useEffect(() => {
    loadReports(selectedStatus);
  }, [loadReports, selectedStatus]);

  async function updateReport(body: Record<string, unknown>, successMessage: string) {
    if (!selectedReport || saving) {
      return;
    }
    const token = await getToken();
    if (!token) {
      setMessage("Log in with an admin account to continue.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await apiRequest<{ report: ListingReportRecord }>(
        `/api/admin/reports/${selectedReport.id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
          retries: 0
        }
      );
      setReports((current) => {
        const matchesCurrentFilter = reportMatchesFilter(response.report, selectedStatus);
        const nextReports = matchesCurrentFilter
          ? current.map((report) => (report.id === response.report.id ? response.report : report))
          : current.filter((report) => report.id !== response.report.id);

        setSelectedReportId((currentSelectedId) => {
          if (matchesCurrentFilter) {
            return response.report.id;
          }
          if (currentSelectedId !== response.report.id) {
            return currentSelectedId;
          }
          return nextReports[0]?.id ?? null;
        });

        return nextReports;
      });
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : "Could not update report.");
    } finally {
      setSaving(false);
    }
  }

  const adminName = account?.fullName ?? "Admin";
  const adminEmail = account?.email ?? "Admin account";

  return (
    <AdminShell active="reports" adminName={adminName} adminEmail={adminEmail}>
      <div className="space-y-4 sm:space-y-5">
        <section className="flex flex-col gap-4 px-3 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Listing reports</h1>
            <p className="mt-2 text-sm text-slate-600">
              Review fraud, unavailable-property, pricing, impersonation, and unsafe-agent reports.
            </p>
          </div>
          <AdminIdentityCard adminName={adminName} adminEmail={adminEmail} />
        </section>

        <section className="px-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-bold">
            {filterItems.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`shrink-0 rounded-full px-4 py-2 transition ${
                  selectedStatus === item.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
                onClick={() => setSelectedStatus(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {message ? <p className="mt-3 rounded-2xl bg-slate-200 p-3 text-sm text-slate-600">{message}</p> : null}
        </section>

        <section className="grid gap-4 px-3 pb-6 sm:px-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.7fr)]">
          <div className="space-y-3">
            {reports.length ? (
              reports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
                    selectedReport?.id === report.id
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-300/80 bg-slate-200 hover:bg-slate-100"
                  }`}
                  onClick={() => setSelectedReportId(report.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-black text-slate-950">
                        {report.listingTitle ?? "Listing report"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {report.agentName ?? "Unknown agent"} - {REPORT_REASON_LABELS[report.reason]}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${severityClass(report.severity)}`}>
                      {report.severity}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{report.details}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-slate-100 px-3 py-1 capitalize text-slate-600">{report.status}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      {new Date(report.createdAt).toLocaleDateString("en-NG")}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-200 p-4 text-sm text-slate-500">No reports in this filter.</p>
            )}
          </div>

          <aside className="self-start rounded-3xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:p-6">
            {selectedReport ? (
              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Selected report</p>
                      <h2 className="mt-1 text-xl font-black text-slate-950">{selectedReport.listingTitle}</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${severityClass(selectedReport.severity)}`}>
                      {selectedReport.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    {REPORT_REASON_LABELS[selectedReport.reason]} - {selectedReport.status}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-300/55 p-4 text-sm text-slate-700">
                  <p className="font-bold text-slate-950">Reporter details</p>
                  <p className="mt-2">{selectedReport.details}</p>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <p>Name: {selectedReport.reporterName ?? "Not provided"}</p>
                    <p>Email: {selectedReport.reporterEmail ?? "Not provided"}</p>
                    <p>Phone: {selectedReport.reporterPhone ?? "Not provided"}</p>
                    <p>User ID: {selectedReport.reporterUserId ?? "Anonymous"}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Link
                    href={`/listings/${selectedReport.listingId}`}
                    className="rounded-2xl bg-white/70 px-4 py-3 text-center text-sm font-bold text-slate-800"
                  >
                    View listing
                  </Link>
                  {selectedReport.agentId ? (
                    <Link
                      href={`/admin/agents/${selectedReport.agentId}`}
                      className="rounded-2xl bg-white/70 px-4 py-3 text-center text-sm font-bold text-slate-800"
                    >
                      View agent
                    </Link>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white/75 px-4 py-3 text-sm outline-none focus:border-blue-400"
                    placeholder="Internal admin notes"
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                  />
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white/75 px-4 py-3 text-sm outline-none focus:border-blue-400"
                    placeholder="Resolution notes"
                    value={resolutionNotes}
                    onChange={(event) => setResolutionNotes(event.target.value)}
                  />
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={() => updateReport({ adminNotes, resolutionNotes }, "Report notes saved.")}
                  >
                    Save notes
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={() => updateReport({ status: "reviewing" }, "Report marked as reviewing.")}
                  >
                    Mark reviewing
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={() => updateReport({ status: "resolved", resolutionNotes }, "Report resolved.")}
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-slate-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={() => updateReport({ status: "dismissed", resolutionNotes }, "Report dismissed.")}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={() => updateReport({ legalHoldListing: true }, "Listing cleanup hold applied.")}
                  >
                    Hold cleanup
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    disabled={saving}
                    onClick={() => updateReport({ hideListing: true, status: "reviewing" }, "Listing hidden and held.")}
                  >
                    Hide listing
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    disabled={saving || !selectedReport.agentId}
                    onClick={() => updateReport({ blockAgent: true, status: "reviewing" }, "Agent blocked.")}
                  >
                    Block agent
                  </button>
                </div>

                <div className="space-y-3 rounded-2xl bg-slate-300/55 p-4">
                  <p className="text-sm font-bold text-slate-950">Request agent response</p>
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white/75 px-4 py-3 text-sm outline-none focus:border-blue-400"
                    placeholder="Write a sanitized message. Do not include reporter identity."
                    value={agentMessage}
                    onChange={(event) => setAgentMessage(event.target.value)}
                  />
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                    disabled={saving || agentMessage.trim().length < 10}
                    onClick={() =>
                      updateReport(
                        { requestAgentResponseMessage: agentMessage, status: "reviewing" },
                        "Agent response request sent."
                      )
                    }
                  >
                    Send to agent
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a report to review.</p>
            )}
          </aside>
        </section>
      </div>
    </AdminShell>
  );
}
