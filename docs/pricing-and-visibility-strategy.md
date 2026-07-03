# C59 Estatehub Pricing And Listing Visibility Strategy

## Market Position

C59 Estatehub should launch below larger Nigerian property portals while still looking trustworthy. The product promise is simple: verified agents get affordable visibility, but ranking is controlled by listing quality, freshness, trust, demand, and capped paid promotion.

Paid placement must never override safety. Blocked agents, rejected agents, inactive listings, unavailable listings, expired listings, and listings without images should not enter the homepage discovery feed.

## Launch Plans

| Plan | Monthly Price | Active Listings | Boosts | Auto Refresh | Featured Credits | Sponsored Slots |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Free Starter | NGN 0 | 3 | 0 | None | 0 | 0 |
| Starter Agent | NGN 7,500 | 20 | 5 | 21 days | 0 | 0 |
| Growth Agent | NGN 14,900 | 80 | 20 | 10 days | 5 | 0 |
| Pro Agent | NGN 29,900 | 250 | 60 | 5 days | 20 | 3 |
| Agency Plus | NGN 59,900 | 750 | 150 | 3 days | 50 | 8 |
| Developer / Enterprise | Custom | Custom | Custom | Custom | Custom | Custom |

Growth Agent should be presented as the most popular plan because it gives strong value against established marketplace tiers without making the platform look cheap.

## Add-Ons

| Add-On | Launch Price |
| --- | --- |
| Manual Boost | NGN 500 per boost |
| Featured Listing | NGN 2,500/day or NGN 10,000/week |
| Sponsored Search Slot | NGN 15,000/week |
| Homepage Feature | NGN 30,000/week |
| Inline Banner Ad | NGN 40,000/month launch price |
| Verified Photo Badge | Free after admin confirmation |

## Feed Eligibility

The homepage and search feed should only consider listings that satisfy all rules:

- Listing `status` is `active`.
- Listing `availability` is `available`.
- Agent is approved and not blocked.
- Listing has at least one image or generated image variant.
- Listing is not expired.

Sold, rented, booked, and expired listings can remain accessible by direct URL if the product decides to preserve old links, but they should not appear in discovery.

## Ranking Model

Every eligible listing receives a weighted visibility score.

| Component | Weight |
| --- | ---: |
| Listing quality | 25% |
| Freshness and boost recency | 20% |
| Agent trust | 20% |
| Engagement | 15% |
| Paid promotion | 15% |
| Diversity and exploration | 5% |

The first implementation uses deterministic quality, freshness, trust baseline, and promotion signals. Engagement can be improved later when impression and click events are collected at scale.

## Quality Signals

Increase score for:

- Clear title and useful description.
- Exact location with area, city, and state.
- Bedrooms, bathrooms, size, amenities, utilities, safety features, and title document.
- Multiple images and generated WebP image variants.
- Verified property photos.

Penalize:

- No images.
- Very short description.
- Repeated contact phrases inside description.
- Missing exact location.
- Low-quality or incomplete listing data.

## Freshness Rules

- Use `boosted_at`, `last_refreshed_at`, or `created_at` as freshness signals.
- Do not fake freshness by changing `created_at`.
- Freshness decays daily.
- Paid plans can refresh automatically based on plan interval.
- Manual boosts update `boosted_at`.

## Paid Promotion Rules

- Sponsored listings can occupy labelled slots such as positions 1, 5, and 12.
- Featured listings receive a moderate search boost and can also appear in a future featured section.
- Premium listings receive capped visibility, never unlimited dominance.
- Every paid placement must be labelled: `Sponsored`, `Featured`, or `Premium`.

## Diversity Rules

- Avoid letting one agent dominate the first page.
- Organic results should target a cap of about two listings per agent per page before filling empty slots.
- Sponsored slots rotate among eligible paid listings.
- Keep a small deterministic exploration score for new listings and new agents.

## Engineering Rollout

1. Keep approved agents free while inventory grows, but run quality ranking immediately.
2. Use Paystack hosted checkout for paid monthly subscriptions.
3. Enforce plan limits server-side before enabling paid subscriptions.
4. Start collecting impressions, detail views, WhatsApp clicks, call clicks, saves, and reports.
5. Use real conversion data to tune weights and pricing upward.

## Current Implementation Notes

- Plan metadata is defined in `src/lib/pricing.ts`.
- Homepage ranking is implemented in `src/lib/listing-visibility.ts`.
- The feed query still comes from Supabase, but results are re-ranked server-side before rendering.
- Supabase schema support is in `docs/supabase-schema.sql`.
- Billing uses Paystack hosted checkout and webhook verification. It is only production-ready after Paystack plans, Vercel env vars, webhook URL, and Supabase SQL are configured.
