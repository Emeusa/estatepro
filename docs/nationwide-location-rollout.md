# Nationwide location and taxonomy rollout

The application registry contains 37 state/FCT records and 774 canonical LGAs or area councils. The count and administrative coverage were cross-checked against Nigeria's National Bureau of Statistics. Legacy C59 spellings remain aliases so old links can redirect to canonical routes.

## Production order

1. Back up the `listings`, `seo_areas`, and `seo_area_redirects` tables.
2. Run the read-only report:

   ```powershell
   npm.cmd run maintenance:normalize-seo
   ```

3. Review every proposed listing correction. The report must show the existing value in `slugUnchanged`.
4. Run the latest `docs/supabase-schema.sql` in Supabase SQL Editor.
5. Apply the reviewed remaining corrections:

   ```powershell
   npm.cmd run maintenance:normalize-seo -- --apply
   ```

6. Run the dry-run command again. It should report zero remaining listing corrections.
7. Run the daily maintenance endpoint or wait for its next scheduled execution so market eligibility, directories, sitemaps, and Search Console monitoring reconcile.

## Safety boundaries

- The maintenance script never updates listing `slug` values.
- Agent-entered area/address text remains unchanged for public display.
- Only canonical state, LGA/Area Council, `areaSlug`, property group, and high-confidence subtype values are normalized.
- Unknown areas are registered under the agent-selected LGA. Only high-confidence known-area aliases can override that selection.
- Thin market pages stay `noindex, follow` until existing inventory thresholds are met.
- Uploads, approval status, availability, subscriptions, promotions, ranking timestamps, reports, authentication, and billing are not modified.
