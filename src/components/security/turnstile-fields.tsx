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
      "error-callback": (code?: string) => void;
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
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [renderDelay, setRenderDelay] = useState(0);

  function removeWidget() {
    try {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
    } catch {
      // A failed cleanup should never crash the page.
    }

    widgetIdRef.current = null;
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }

  function retryWidget() {
    removeWidget();
    setToken("");
    setWidgetError("");
    setRenderDelay(0);
    setRenderAttempt((current) => current + 1);
    try {
      if (window.turnstile) {
        setScriptReady(true);
      }
    } catch {
      setWidgetError(turnstileLoadMessage());
    }
  }

  function turnstileLoadMessage() {
    return "Security check could not load. Check your connection, then tap retry.";
  }

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || widgetIdRef.current) {
      return;
    }

    let cancelled = false;
    const turnstileSiteKey = siteKey;

    function renderWidget() {
      if (cancelled || !containerRef.current || widgetIdRef.current) {
        return;
      }

      if (!window.turnstile?.render) {
        if (renderDelay < 5) {
          window.setTimeout(() => {
            if (!cancelled) {
              setRenderDelay((current) => current + 1);
            }
          }, 250);
          return;
        }

        setToken("");
        setWidgetError(turnstileLoadMessage());
        return;
      }

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: turnstileSiteKey,
          callback: (value) => {
            setToken(value);
            setWidgetError("");
          },
          "expired-callback": () => {
            setToken("");
            setWidgetError("Security check expired. Tap retry, then submit the form again.");
          },
          "error-callback": () => {
            setToken("");
            setWidgetError(turnstileLoadMessage());
          }
        });
      } catch {
        setToken("");
        setWidgetError(turnstileLoadMessage());
      }
    }

    renderWidget();

    return () => {
      cancelled = true;
      removeWidget();
    };
  }, [renderAttempt, renderDelay, scriptReady, siteKey]);

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
            onError={() => setWidgetError(turnstileLoadMessage())}
          />
          <div ref={containerRef} />
        </>
      ) : null}
      {showMissingSiteKeyWarning ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Security check is temporarily unavailable. Please try again later.
        </p>
      ) : null}
      {widgetError ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <p>{widgetError}</p>
          <button
            className="rounded-full border border-amber-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-950 transition hover:bg-amber-100"
            type="button"
            onClick={retryWidget}
          >
            Retry security check
          </button>
        </div>
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
