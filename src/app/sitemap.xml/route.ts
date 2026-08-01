import { getSiteUrl } from "@/lib/seo";
import { createSitemapIndex, xmlResponse } from "@/lib/sitemap-xml";

export async function GET() {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  return xmlResponse(createSitemapIndex([
    `${siteUrl}/sitemaps/listings.xml`,
    `${siteUrl}/sitemaps/markets.xml`,
    `${siteUrl}/sitemaps/guides.xml`
  ]));
}
