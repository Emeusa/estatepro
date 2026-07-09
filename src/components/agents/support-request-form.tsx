"use client";

import { FormEvent, useState } from "react";

import { apiRequest } from "@/lib/api";
import { AgentEntitlements } from "@/lib/types";

type Props = {
  token: string;
  entitlements?: AgentEntitlements;
};

export function SupportRequestForm({ token, entitlements }: Props) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!entitlements || entitlements.planSlug === "free_starter") {
    return null;
  }

  async function submitSupportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    try {
      await apiRequest("/api/support/requests", {
        method: "POST",
        retries: 0,
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, message })
      });
      setSubject("");
      setMessage("");
      setStatus("Support request sent.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send support request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-slate-300/60 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {entitlements.hasPrioritySupport ? "Priority support" : "Support"}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-700">
        Send account, billing, or listing visibility issues to the admin team.
      </p>
      <form className="mt-3 grid gap-2" onSubmit={submitSupportRequest}>
        <input
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          maxLength={120}
          minLength={4}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Subject"
          required
          value={subject}
        />
        <textarea
          className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          maxLength={1200}
          minLength={10}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Describe the issue"
          required
          value={message}
        />
        <button
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Sending..." : "Send support request"}
        </button>
      </form>
      {status ? <p className="mt-3 text-sm font-semibold text-slate-600">{status}</p> : null}
    </div>
  );
}
