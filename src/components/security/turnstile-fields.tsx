"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  remove?: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileFields() {
  const startedAt = useMemo(() => Date.now(), []);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const showMissingSiteKeyWarning = !siteKey && process.env.NODE_ENV === "production";
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState("");
  const [widgetError, setWidgetError] = useState("");

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (value) => {
        setToken(value);
        setWidgetError("");
      },
      "expired-callback": () => {
        setToken("");
        setWidgetError("Security verification expired. Please complete it again.");
      },
      "error-callback": () => {
        setToken("");
        setWidgetError("Security verification could not load. Refresh the page and try again.");
      }
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [scriptReady, siteKey]);

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
      <input name="cf-turnstile-response" type="hidden" value={token} />
      {siteKey ? (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onLoad={() => setScriptReady(true)}
            onReady={() => setScriptReady(true)}
            onError={() => setWidgetError("Security verification could not load. Refresh the page and try again.")}
          />
          <div ref={containerRef} />
        </>
      ) : null}
      {showMissingSiteKeyWarning ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Security verification is not configured for this deployment. Please refresh after the site is redeployed.
        </p>
      ) : null}
      {widgetError ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {widgetError}
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
