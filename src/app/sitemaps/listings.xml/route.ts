import { getSiteUrl } from "@/lib/seo";
import { createUrlSet, xmlResponse } from "@/lib/sitemap-xml";
import { listPublicListingSitemapEntries } from "@/modules/listings/listing.repository";

export async function GET() {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  const listings = await listPublicListingSitemapEntries(45000);
  return xmlResponse(createUrlSet(listings.map((listing) => ({
    url: `${siteUrl}/listings/${listing.slug}`,
    lastModified: listing.updatedAt
  }))));
}
