"use client";

import { useEffect, useState } from "react";

import { ApiRequestError, apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";

type Props = {
  listingId: string;
  initialSaved?: boolean;
  className?: string;
  iconClassName?: string;
  onSavedChange?: (saved: boolean) => void;
};

function getLoginReturnHref() {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

async function getSessionToken() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export function SaveListingButton({
  listingId,
  initialSaved,
  className,
  iconClassName,
  onSavedChange
}: Props) {
  const [saved, setSaved] = useState(Boolean(initialSaved));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSaved(Boolean(initialSaved));
  }, [initialSaved, listingId]);

  useEffect(() => {
    if (initialSaved !== undefined) {
      return;
    }

    let active = true;

    async function loadSavedState() {
      const token = await getSessionToken();
      if (!token) {
        return;
      }

      try {
        const response = await apiRequest<{ savedListingIds: string[] }>(
          `/api/saved-listings?listingIds=${encodeURIComponent(listingId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            retries: 0
          }
        );
        if (active) {
          setSaved(response.savedListingIds.includes(listingId));
        }
      } catch {
        // Save state is non-critical; the click path still performs the real action.
      }
    }

    loadSavedState();
    return () => {
      active = false;
    };
  }, [initialSaved, listingId]);

  async function toggleSaved() {
    if (loading) {
      return;
    }

    const token = await getSessionToken();
    if (!token) {
      window.location.assign(getLoginReturnHref());
      return;
    }

    setLoading(true);
    try {
      if (saved) {
        await apiRequest(`/api/saved-listings/${listingId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          retries: 0
        });
        setSaved(false);
        onSavedChange?.(false);
        return;
      }

      await apiRequest("/api/saved-listings", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId }),
        retries: 0
      });
      setSaved(true);
      onSavedChange?.(true);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        window.location.assign(getLoginReturnHref());
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={saved ? "Remove saved listing" : "Save listing"}
      title={saved ? "Remove saved listing" : "Save listing"}
      aria-pressed={saved}
      disabled={loading}
      onClick={toggleSaved}
      className={
        className ??
        "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:scale-105 hover:text-rose-600 disabled:cursor-wait disabled:opacity-70"
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`${iconClassName ?? "h-5 w-5"} ${saved ? "fill-rose-600 stroke-rose-600" : "fill-none stroke-current"} stroke-2`}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.2 6.1c-1.7-2-4.5-2.1-6.3-.3L12 7.7l-1.9-1.9C8.3 4 5.5 4.1 3.8 6.1c-1.8 2.1-1.5 5.3.5 7.3l6.6 6.4a1.6 1.6 0 0 0 2.2 0l6.6-6.4c2-2 2.3-5.2.5-7.3Z"
        />
      </svg>
    </button>
  );
}
