"use client";

import Script from "next/script";
import { useMemo } from "react";

export function TurnstileFields() {
  const startedAt = useMemo(() => Date.now(), []);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
