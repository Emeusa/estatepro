"use client";

import { FormEvent, useState } from "react";

import { TurnstileFields, readBotFields } from "@/components/security/turnstile-fields";
import { ApiRequestError, apiRequest } from "@/lib/api";
import { REPORT_REASON_LABELS } from "@/lib/report-labels";
import { supabase } from "@/lib/supabase/client";
import type { ListingReportReason } from "@/lib/types";

type Props = {
  listingId: string;
  listingTitle: string;
  variant?: "text" | "icon";
  className?: string;
  iconClassName?: string;
};

const reasons: ListingReportReason[] = [
  "fake",
  "unavailable",
  "duplicate",
  "wrong_price",
  "scam",
  "payment_request",
  "impersonation",
  "unsafe_agent",
  "other"
];

function ReportIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? "h-4 w-4 fill-current"}>
      <path d="M12 2.25 20 5.2v5.78c0 5.07-3.26 9.47-8 10.77-4.74-1.3-8-5.7-8-10.77V5.2l8-2.95Zm0 4.05a.9.9 0 0 0-.9.9v5.15a.9.9 0 1 0 1.8 0V7.2a.9.9 0 0 0-.9-.9Zm0 10.75a1.12 1.12 0 1 0 0-2.24 1.12 1.12 0 0 0 0 2.24Z" />
    </svg>
  );
}

export function ReportListingButton({
  listingId,
  listingTitle,
  variant = "text",
  className,
  iconClassName
}: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const {
      data: { session }
    } = await supabase.auth.getSession();

    setSubmitting(true);
    setMessage("");
    try {
      const response = await apiRequest<{ message: string }>(`/api/listings/${listingId}/reports`, {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: JSON.stringify({
          reason: form.get("reason")?.toString(),
          details: form.get("details")?.toString(),
          reporterName: form.get("reporterName")?.toString(),
          reporterEmail: form.get("reporterEmail")?.toString(),
          reporterPhone: form.get("reporterPhone")?.toString(),
          ...readBotFields(form)
        }),
        retries: 0
      });
      setMessage(response.message);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Report listing"
        title="Report listing"
        className={
          className ??
          (variant === "icon"
            ? "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:scale-105 hover:bg-rose-50 hover:text-rose-700"
            : "inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-rose-700 transition hover:border-rose-300 hover:bg-rose-100")
        }
        onClick={() => {
          setOpen(true);
          setMessage("");
        }}
      >
        {variant === "icon" ? (
          <>
            <ReportIcon className={iconClassName ?? "h-4 w-4 fill-current"} />
            <span className="sr-only">Report listing</span>
          </>
        ) : (
          "Report listing"
        )}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Safety report</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Report this listing</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Reports are private and reviewed by C59 Estatehub admins. Do not include bank details, NIN, or
                  sensitive private information.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">
              {listingTitle}
            </p>

            <form className="mt-4 space-y-4" onSubmit={submitReport}>
              <label className="block text-sm font-bold text-slate-700">
                Reason
                <select
                  name="reason"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-400"
                  defaultValue="fake"
                >
                  {reasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {REPORT_REASON_LABELS[reason]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                What happened?
                <textarea
                  name="details"
                  required
                  minLength={20}
                  maxLength={1000}
                  className="mt-2 min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-400"
                  placeholder="Explain what looks fake, unavailable, unsafe, or misleading. Include dates and payment requests if relevant."
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  name="reporterName"
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-400"
                  placeholder="Your name (optional)"
                />
                <input
                  name="reporterEmail"
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-400"
                  placeholder="Email (optional)"
                  type="email"
                />
                <input
                  name="reporterPhone"
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-400"
                  placeholder="Phone (optional)"
                  type="tel"
                />
              </div>

              <TurnstileFields />

              {message ? (
                <p className="rounded-2xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">{message}</p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit private report"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
