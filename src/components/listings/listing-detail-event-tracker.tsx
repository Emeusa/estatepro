"use client";

import { useEffect } from "react";

import { trackListingEvent } from "@/lib/listing-events";

export function ListingDetailEventTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    trackListingEvent(listingId, "detail_view");
  }, [listingId]);

  return null;
}
