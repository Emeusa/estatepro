import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { shouldOptimizeListingImage } from "../../src/lib/listing-image-optimization";

function readSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("public listing feed image performance", () => {
  it("caps public card image payloads while preserving the real image count", () => {
    const repositorySource = readSource("src/modules/listings/listing.repository.ts");
    const typeSource = readSource("src/lib/types.ts");

    expect(typeSource).toContain("imageCount: number");
    expect(repositorySource).toContain("const PUBLIC_CARD_IMAGE_LIMIT = 4");
    expect(repositorySource).toContain("imageCount: getListingImageCount(listing)");
    expect(repositorySource).toContain("imageUrls: listing.imageUrls.slice(0, PUBLIC_CARD_IMAGE_LIMIT)");
    expect(repositorySource).toContain(".slice(0, PUBLIC_CARD_IMAGE_LIMIT)");
  });

  it("keeps listing detail on full listing records instead of capped card records", () => {
    const serviceSource = readSource("src/modules/listings/listing.service.ts");

    expect(serviceSource).toContain("const listing = await getPublicListingByIdentifier(listingId)");
    expect(serviceSource).toContain("return { listing, agent }");
    expect(serviceSource).not.toContain("toPublicListingCardRecord(listing");
  });

  it("uses the real photo count on public cards after image arrays are capped", () => {
    const cardSource = readSource("src/components/listings/listing-card.tsx");
    const rowSource = readSource("src/components/listings/listing-desktop-row.tsx");

    expect(cardSource).toContain("const photoCount = listing.imageCount ?? images.length");
    expect(cardSource).toContain("{photoCount}");
    expect(rowSource).toContain("const photoCount = listing.imageCount ?? images.length");
    expect(rowSource).toContain("<PhotoCount count={photoCount} />");
  });

  it("uses Next Image optimization for configured Supabase listing images with a safe fallback", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";

    expect(
      shouldOptimizeListingImage(
        "https://project.supabase.co/storage/v1/object/public/listing-images/agent-id/photo-card.webp"
      )
    ).toBe(true);
    expect(shouldOptimizeListingImage("https://project.supabase.co/storage/v1/object/public/avatars/photo.webp")).toBe(
      false
    );
    expect(shouldOptimizeListingImage("https://example.com/storage/v1/object/public/listing-images/photo.webp")).toBe(
      false
    );

    for (const componentPath of [
      "src/components/listings/listing-card.tsx",
      "src/components/listings/listing-desktop-row.tsx",
      "src/components/listings/listing-image-gallery.tsx",
      "src/components/listings/similar-listing-card.tsx",
      "src/components/listings/listing-contact-actions.tsx"
    ]) {
      const source = readSource(componentPath);
      expect(source).toContain("shouldOptimizeListingImage");
      expect(source).not.toContain("unoptimized={image.isPreprocessed}");
      expect(source).not.toContain("unoptimized={preview.isPreprocessed}");
      expect(source).not.toContain("unoptimized={selectedImage.isPreprocessed}");
    }
  });
});

describe("homepage listing freshness", () => {
  it("marks the homepage feed stale after successful agent listing mutations", () => {
    const managerSource = readSource("src/components/agents/listing-manager.tsx");

    expect(managerSource).toContain("markHomepageListingsStale");
    expect(managerSource.match(/markHomepageListingsStale\(\)/g) ?? []).toHaveLength(4);
  });

  it("refreshes the homepage once when a listing mutation marker exists", () => {
    const pageSource = readSource("src/app/page.tsx");
    const guardSource = readSource("src/components/listings/homepage-freshness-guard.tsx");

    expect(pageSource).toContain('export const dynamic = "force-dynamic"');
    expect(pageSource).toContain("<HomepageFreshnessGuard />");
    expect(guardSource).toContain("window.sessionStorage.getItem");
    expect(guardSource).toContain("window.sessionStorage.removeItem");
    expect(guardSource).toContain("router.refresh()");
  });

  it("revalidates public listing paths after successful listing mutations", () => {
    const cacheSource = readSource("src/modules/listings/listing-cache.ts");

    expect(cacheSource).toContain('safeRevalidatePath("/")');
    expect(cacheSource).toContain("safeRevalidatePath(`/agents/${listing.agentId}/listings`)");
    expect(cacheSource).toContain("safeRevalidatePath(`/listings/${listing.slug}`)");
    expect(cacheSource).toContain("cache revalidation failed");

    for (const routePath of [
      "src/app/api/listings/route.ts",
      "src/app/api/listings/[listingId]/route.ts",
      "src/app/api/listings/[listingId]/promotions/route.ts",
      "src/app/api/listings/[listingId]/retention/route.ts",
      "src/app/api/admin/listings/[listingId]/route.ts"
    ]) {
      expect(readSource(routePath)).toContain("revalidateListingMutationPaths");
    }
  });

  it("prevents public listing API responses from being browser cached", () => {
    const routeSource = readSource("src/app/api/listings/route.ts");

    expect(routeSource).toContain('response.headers.set("Cache-Control", "no-store, max-age=0")');
  });
});
