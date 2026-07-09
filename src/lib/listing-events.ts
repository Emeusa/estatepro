"use client";

type ListingEventType = "impression" | "detail_view" | "whatsapp_click" | "phone_click";

function getSessionId() {
  const key = "c59_listing_session";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) {
      return existing;
    }
    const next = crypto.randomUUID();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return null;
  }
}

export function trackListingEvent(listingId: string, eventType: ListingEventType) {
  if (!listingId) {
    return;
  }

  fetch("/api/listings/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId,
      eventType,
      sessionId: getSessionId()
    }),
    keepalive: true
  }).catch(() => undefined);
}
