import { PROPERTY_GUIDES } from "@/content/guides";
import { getSiteUrl } from "@/lib/seo";
import { createUrlSet, xmlResponse } from "@/lib/sitemap-xml";

export async function GET() {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  return xmlResponse(createUrlSet([
    { url: `${siteUrl}/guides`, lastModified: PROPERTY_GUIDES[0]?.updatedAt },
    ...PROPERTY_GUIDES.map((guide) => ({ url: `${siteUrl}/guides/${guide.slug}`, lastModified: guide.updatedAt }))
  ]));
}
