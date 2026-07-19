import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo";
import { listPublicListingSitemapEntries } from "@/modules/listings/listing.repository";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  let listings: Awaited<ReturnType<typeof listPublicListingSitemapEntries>> = [];

  try {
    listings = await listPublicListingSitemapEntries();
  } catch {
    listings = [];
  }

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1
    },
    ...listings.map((listing) => ({
      url: `${siteUrl}/listings/${listing.slug}`,
      lastModified: new Date(listing.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  ];
}
