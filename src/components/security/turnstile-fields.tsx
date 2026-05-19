"use client";

import Script from "next/script";
import { useMemo } from "react";

export function TurnstileFields() {
  const startedAt = useMemo(() => Date.now(), []);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const showMissingSiteKeyWarning = !siteKey && process.env.NODE_ENV === "production";

  return (
    <>
      <input
        aria-hidden="true"
        autoComplete="off"
        className="hidden"
        name="website"
        tabIndex={-1}
        type="text"
      />
      <input name="formStartedAt" type="hidden" value={startedAt} />
      {siteKey ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          <div className="cf-turnstile" data-sitekey={siteKey} />
        </>
      ) : null}
      {showMissingSiteKeyWarning ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Security verification is not configured for this deployment. Please refresh after the site is redeployed.
        </p>
      ) : null}
    </>
  );
}

export function readBotFields(form: FormData) {
  return {
    website: form.get("website")?.toString() ?? "",
    formStartedAt: Number(form.get("formStartedAt") ?? 0) || undefined,
    turnstileToken: form.get("cf-turnstile-response")?.toString() || undefined
  };
}
