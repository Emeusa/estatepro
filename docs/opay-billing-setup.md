# OPay Billing Setup

OPay is implemented as a prepaid monthly payment method. Paystack remains the recurring subscription provider. An OPay payment activates the selected plan for one billing month, then the agent can renew manually.

## 1. Create OPay Merchant Access

1. Log in to the OPay merchant dashboard.
2. Complete merchant/KYC setup if required.
3. Start with sandbox/test credentials before using live credentials.
4. Copy the merchant credentials:
   - Merchant ID
   - Public Key
   - Private Key

Do not put the private key in any browser code. It belongs only in Vercel server environment variables.

## 2. Add Vercel Environment Variables

For Preview, use OPay sandbox/test credentials:

```env
OPAY_ENV=test
OPAY_MERCHANT_ID=...
OPAY_PUBLIC_KEY=...
OPAY_PRIVATE_KEY=...
```

For Production, use live credentials:

```env
OPAY_ENV=live
OPAY_MERCHANT_ID=...
OPAY_PUBLIC_KEY=...
OPAY_PRIVATE_KEY=...
NEXT_PUBLIC_SITE_URL=https://c59estatehub.com
BILLING_LIVE_ENABLED=true
```

Redeploy after changing Vercel environment variables.

## 3. Configure OPay Callback URLs

Set the OPay server callback/webhook URL to:

```text
https://c59estatehub.com/api/billing/opay/webhook
```

The app sends successful checkout returns to:

```text
https://c59estatehub.com/api/billing/opay/verify?reference=...
```

If the OPay dashboard asks for an allowed domain or callback domain, add:

```text
c59estatehub.com
www.c59estatehub.com
```

## 4. Run Supabase SQL

Run the latest `docs/supabase-schema.sql` in Supabase SQL Editor before testing OPay. The new fields include:

- `subscriptions.payment_provider`
- `subscriptions.billing_mode`
- `subscriptions.opay_order_no`
- `subscriptions.opay_transaction_id`
- `billing_transactions.payment_provider`
- `billing_transactions.opay_order_no`
- `billing_transactions.opay_transaction_id`

The migration also makes `billing_transactions.paystack_plan_code` nullable so OPay transactions can be stored.

## 5. Test OPay Sandbox

1. Log in as an approved, unblocked agent.
2. Open `/agents/dashboard#subscription`.
3. Select a paid plan and click `Pay with OPay`.
4. Complete sandbox checkout.
5. Confirm the redirect returns to the dashboard with payment success.
6. Confirm Supabase:
   - `subscriptions.payment_provider = 'opay'`
   - `subscriptions.billing_mode = 'prepaid'`
   - `subscriptions.current_period_end` is about one month ahead
   - `billing_transactions.status = 'success'`
7. Confirm OPay webhook delivery returns `200`.
8. Test a failed or cancelled payment and confirm the plan is not activated.

## 6. Live Launch Checklist

1. Replace Preview credentials with live credentials only in Production.
2. Confirm `https://c59estatehub.com` is live with SSL.
3. Confirm Paystack still works if it remains enabled.
4. Make one controlled small live OPay payment.
5. Confirm the plan activates and expires after one month.
6. Confirm lower plans stay disabled until the active paid plan expires.

## Important Behavior

- OPay does not show `Cancel renewal` because OPay plans do not auto-renew in this implementation.
- Active Paystack recurring users cannot switch to OPay until the Paystack period expires, to avoid double billing.
- Active OPay prepaid users can upgrade, but lower plans remain disabled until the current period expires.
