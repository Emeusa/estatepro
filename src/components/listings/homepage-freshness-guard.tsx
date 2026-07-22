"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const HOMEPAGE_LISTING_REFRESH_KEY = "c59:homepage-listings-refresh-at";

export function markHomepageListingsStale() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(HOMEPAGE_LISTING_REFRESH_KEY, Date.now().toString());
}

export function HomepageFreshnessGuard() {
  const router = useRouter();
  const refreshed = useRef(false);

  useEffect(() => {
    if (refreshed.current || typeof window === "undefined") {
      return;
    }

    const marker = window.sessionStorage.getItem(HOMEPAGE_LISTING_REFRESH_KEY);
    if (!marker) {
      return;
    }

    refreshed.current = true;
    window.sessionStorage.removeItem(HOMEPAGE_LISTING_REFRESH_KEY);
    router.refresh();
  }, [router]);

  return null;
}
