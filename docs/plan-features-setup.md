# Plan Feature Setup

Paid plan features are implemented in app code and require the latest Supabase schema.

## Required Manual Setup

1. Run `docs/supabase-schema.sql` in Supabase SQL Editor.
2. Add `CRON_SECRET` to Vercel Production and Preview.
3. Configure a daily Vercel Cron job to call:

```text
https://c59estatehub.com/api/cron/auto-refresh
```

4. Send the cron request with:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

## What Is Implemented

- Paid subscriptions receive monthly boost, featured, and sponsored credits.
- Boost updates `boosted_at` and `last_refreshed_at`.
- Featured and sponsored credits run for 7 days and affect feed ranking badges.
- Listing impressions, detail views, phone clicks, and WhatsApp clicks are tracked.
- Starter/Growth agents see basic totals; Pro/Agency Plus agents see listing-level analytics.
- Daily auto-refresh updates `last_refreshed_at` for eligible active available listings.
- Growth and higher agents show priority badges in admin workflows.
- Agency Plus support requests are marked highest priority.
