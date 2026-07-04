# Paystack Billing Setup

## 1. Start In Paystack Test Mode

1. Log in to Paystack.
2. Switch to Test Mode.
3. Open `Settings > API Keys & Webhooks`.
4. Copy the test secret key.

## 2. Create Monthly Plans

Create these Paystack plans with interval `monthly`:

| C59 plan | Paystack amount |
| --- | ---: |
| Starter Agent | 750000 kobo |
| Growth Agent | 1490000 kobo |
| Pro Agent | 2990000 kobo |
| Agency Plus | 5990000 kobo |

Copy each generated `plan_code`.

## 3. Add Vercel Environment Variables

Add these variables to both Preview and Production, then redeploy:

```env
PAYSTACK_SECRET_KEY=sk_test_or_live_...
PAYSTACK_PLAN_STARTER_AGENT=PLN_...
PAYSTACK_PLAN_GROWTH_AGENT=PLN_...
PAYSTACK_PLAN_PRO_AGENT=PLN_...
PAYSTACK_PLAN_AGENCY_PLUS=PLN_...
NEXT_PUBLIC_SITE_URL=https://c59estatehub.com
BILLING_LIVE_ENABLED=false
```

Use live keys only after the full test-mode flow works.

Set `BILLING_LIVE_ENABLED=true` only after you have configured live Paystack keys, live plan codes, live webhook URL, and completed one controlled live payment test.

## 4. Configure Paystack Webhook

Set webhook URL:

```text
https://c59estatehub.com/api/billing/webhook
```

If Paystack asks for a callback URL, use:

```text
https://c59estatehub.com/agents/dashboard#subscription
```

The app itself sends checkout callbacks to `/api/billing/verify` so payment is verified server-side before redirecting the agent back to the dashboard.

## 5. Run Supabase SQL

Run the latest `docs/supabase-schema.sql` in Supabase SQL Editor before testing billing. Billing depends on:

- `billing_transactions`
- extended `subscriptions` Paystack columns
- billing RLS policies
- plan seed rows

## 6. Test

1. Log in as an approved, unblocked agent.
2. Open `/agents/dashboard#subscription`.
3. Click `Upgrade` on Growth Agent or another paid plan.
4. Complete checkout with a Paystack test card.
5. Confirm the dashboard returns with `Payment confirmed. Your plan has been updated.`
6. Confirm the `subscriptions` row has the paid `plan_slug`.
7. Confirm Paystack webhook delivery shows `200`.
8. Test invalid webhook signatures only in local/test tooling; forged webhooks should return `401`.

Pending, rejected, or blocked agents cannot upgrade until admin approval.
