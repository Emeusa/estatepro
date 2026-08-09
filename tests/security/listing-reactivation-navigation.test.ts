import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { shouldRedirectListingReactivationToSubscription } from "../../src/lib/listing-retention";

function listingLifecycle(
  overrides: Partial<Parameters<typeof shouldRedirectListingReactivationToSubscription>[0]> = {}
) {
  return {
    status: "inactive" as const,
    deactivationReason: null,
    mediaDeletedAt: null,
    ...overrides
  };
}

describe("expired-plan listing reactivation", () => {
  it("redirects plan-limit and expired-subscription listings to subscription management", () => {
    expect(
      shouldRedirectListingReactivationToSubscription(
        listingLifecycle({ deactivationReason: "plan_limit" })
      )
    ).toBe(true);
    expect(
      shouldRedirectListingReactivationToSubscription(
        listingLifecycle({ deactivationReason: "subscription_expired" })
      )
    ).toBe(true);
  });

  it("keeps ordinary inactive listings on the direct reactivation flow", () => {
    expect(
      shouldRedirectListingReactivationToSubscription(
        listingLifecycle({ deactivationReason: "unavailable_archived" })
      )
    ).toBe(false);
    expect(
      shouldRedirectListingReactivationToSubscription(
        listingLifecycle({ status: "active", deactivationReason: "plan_limit" })
      )
    ).toBe(false);
  });

  it("does not offer subscription reactivation after listing media has been deleted", () => {
    expect(
      shouldRedirectListingReactivationToSubscription(
        listingLifecycle({ deactivationReason: "plan_limit", mediaDeletedAt: "2026-08-09T00:00:00.000Z" })
      )
    ).toBe(false);
  });

  it("renders plan-related reactivation as a link while preserving the retention API button", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/agents/listing-manager.tsx"),
      "utf8"
    );

    expect(source).toContain("shouldRedirectListingReactivationToSubscription(listing)");
    expect(source).toContain('href="/agents/subscription"');
    expect(source).toContain('updateRetentionAction(listing.id, "reactivate")');
  });
});
