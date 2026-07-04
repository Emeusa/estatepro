# Paystack Live Launch Checklist

Use this after Paystack test mode checkout, callback, and webhook are confirmed working.

## 1. Production Foundation

- Confirm `https://c59estatehub.com` has a valid SSL certificate.
- Confirm login, agent signup, Turnstile, and `/agents/dashboard` work on the custom domain.
- Confirm the latest `docs/supabase-schema.sql` has been run in Supabase.
- Keep Preview deployments on Paystack test keys.

## 2. Paystack Live Mode

In Paystack Live Mode, create monthly plans:

| Plan | Amount |
| --- | ---: |
| Starter Agent | NGN 7,500 |
| Growth Agent | NGN 14,900 |
| Pro Agent | NGN 29,900 |
| Agency Plus | NGN 59,900 |

Copy each live `PLN_...` code. Do not reuse test plan codes.

## 3. Vercel Production Environment

Set these only in Vercel Production:

```env
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PLAN_STARTER_AGENT=PLN_live_...
PAYSTACK_PLAN_GROWTH_AGENT=PLN_live_...
PAYSTACK_PLAN_PRO_AGENT=PLN_live_...
PAYSTACK_PLAN_AGENCY_PLUS=PLN_live_...
NEXT_PUBLIC_SITE_URL=https://c59estatehub.com
ALLOWED_ORIGINS=https://c59estatehub.com,https://www.c59estatehub.com
BILLING_LIVE_ENABLED=false
```

Redeploy after saving env vars.

## 4. Live Webhook

In Paystack Live Mode, set webhook URL:

```text
https://c59estatehub.com/api/billing/webhook
```

If Paystack asks for callback URL, use:

```text
https://c59estatehub.com/agents/dashboard#subscription
```

## 5. Controlled Live Payment

1. Temporarily set `BILLING_LIVE_ENABLED=true` in Vercel Production.
2. Redeploy production.
3. Use one approved, unblocked test agent account.
4. Buy the cheapest paid plan with a real card.
5. Confirm dashboard shows the paid plan.
6. Confirm Supabase `subscriptions.plan_slug` changed correctly.
7. Confirm Supabase `billing_transactions.status = success`.
8. Confirm Paystack webhook log returns `200`.
9. Test `Cancel renewal` once if Paystack provides the subscription code and email token.

## 6. Public Launch

- Keep `BILLING_LIVE_ENABLED=true` only after the controlled live payment and webhook pass.
- If live verification fails, set `BILLING_LIVE_ENABLED=false`, redeploy, and investigate before taking more payments.
- Do not announce paid plans until checkout, webhook, subscription update, and cancellation behavior are verified.
