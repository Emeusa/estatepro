# C59 Estatehub SEO Operations

## Positioning

C59 Estatehub is a Nigeria-wide property marketplace. Uyo, Lagos, Abuja, and every other location are individual markets, not the platform identity. Public claims must be supported by current inventory, product behavior, or attributable sources.

## August 2026 Baseline

- Branded query `c59 estatehub`: observed at the first organic position.
- Tested non-branded national and location queries: no stable first-page position observed.
- Live inventory at baseline: 14 active listings across Lagos and Akwa Ibom.
- Treat `site:` searches as diagnostic samples only. Google Search Console is the indexing and performance source of truth.

## Weekly Search Console Review

Export Search Console performance for the previous 7 and 28 days and segment it by:

- branded versus non-branded query;
- listing, market, guide, homepage, and agent page;
- country, device, and search appearance;
- clicks, impressions, click-through rate, and average position;
- pages gaining impressions but receiving no clicks;
- pages losing inventory or becoming unavailable.

Track business outcomes alongside search data: listing detail views, calls, WhatsApp clicks, saves, reports, agent registrations, and completed listings.

## Automatic Search Console Monitoring

The daily listing-maintenance cron automatically keeps eligible listing and market URLs in the SEO monitoring queue. It inspects prioritized URLs after approximately 3, 10, and 30 days, then records Google coverage, crawl, robots, fetch, and canonical status in `/admin/seo`.

Google does not provide a general indexing-request API for property pages. C59 therefore uses canonical pages, crawlable links, accurate sitemap `lastmod` values, and read-only URL Inspection monitoring. The monitor never changes listing visibility and a Google API outage never blocks listing creation or updates.

One-time setup:

1. Create or select a Google Cloud project and enable the Google Search Console API.
2. Create a service account and download its JSON key once.
3. In Search Console, open `c59estatehub.com` → Settings → Users and permissions.
4. Add the service-account email as a Full user.
5. Add `GOOGLE_SEARCH_CONSOLE_ENABLED=true` in Vercel Production.
6. Add `GOOGLE_SEARCH_CONSOLE_PROPERTY=sc-domain:c59estatehub.com`.
7. Add the service account `client_email` as `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL`.
8. Add the service account `private_key` as `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`.
9. Keep all four variables server-only. Never use a `NEXT_PUBLIC_` prefix or commit the JSON key.
10. Apply the latest `docs/supabase-schema.sql`, redeploy, and confirm `/admin/seo` starts showing inspection dates after the first scheduled window.

The root sitemap only needs to be submitted once in Search Console. Its listing and market children update automatically as public inventory changes.

## Nationwide Keyword Set

Start with national intent (`property for rent in Nigeria`, `property for sale in Nigeria`, `short let Nigeria`, `land for sale Nigeria`) and expand from active inventory. For every newly active state or city, add category, property-type, bedroom, safety, and agent searches only when a matching useful page exists.

Do not publish or report estimated search volumes as facts unless they come from a dated Google Ads, Search Console, Semrush, Ahrefs, or equivalent export. Do not promise ranking dates or positions.

## Release Checklist

- Inspect homepage, one market page, one listing, and one guide in Search Console.
- Confirm canonical URL, index/noindex status, rendered HTML, and mobile usability.
- Validate structured data and all sitemap partitions.
- Confirm legacy UUID and `www` requests return permanent redirects.
- Record PageSpeed mobile LCP, CLS, and accessibility before and after major layout changes.
- Review `/admin/seo` for growing markets, indexable markets, and threshold reasons.
