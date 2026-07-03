# Custom Domain Setup: c59estatehub.com

## 1. Add The Domain In Vercel

1. Open Vercel.
2. Select the C59 Estatehub project.
3. Go to `Settings > Domains`.
4. Add:
   - `c59estatehub.com`
   - `www.c59estatehub.com`
5. Set `c59estatehub.com` as the production domain.
6. Keep `www.c59estatehub.com` as a redirect to `c59estatehub.com` unless you intentionally want `www` as primary.

## 2. Add DNS Records At Your Domain Registrar

Use the exact records Vercel shows in `Settings > Domains`.

Typical Vercel setup:

| Host | Type | Value |
| --- | --- | --- |
| `@` | `A` | `76.76.21.21` |
| `www` | `CNAME` | `cname.vercel-dns.com` or the Vercel-provided CNAME |

If Vercel asks for a TXT verification record, add that TXT record too.

DNS can take a few minutes to several hours to propagate.

## 3. Update Vercel Environment Variables

In Vercel `Settings > Environment Variables`, set these for Production and Preview where needed:

```env
NEXT_PUBLIC_SITE_URL=https://c59estatehub.com
ALLOWED_ORIGINS=https://c59estatehub.com,https://www.c59estatehub.com
```

After changing `NEXT_PUBLIC_SITE_URL`, redeploy. Public env vars are baked into the client build.

## 4. Update Supabase Auth URLs

In Supabase:

1. Go to `Authentication > URL Configuration`.
2. Set `Site URL` to:

```text
https://c59estatehub.com
```

3. Add redirect URLs:

```text
https://c59estatehub.com/**
https://www.c59estatehub.com/**
https://estatepro-tawny.vercel.app/**
http://localhost:3000/**
```

Keep the Vercel URL temporarily until you fully confirm production login/signup on the custom domain.

## 5. Update Cloudflare Turnstile

In Cloudflare Turnstile widget settings, allow these hostnames:

```text
c59estatehub.com
www.c59estatehub.com
estatepro-tawny.vercel.app
localhost
```

If you create a new widget, update Vercel with the new:

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Then redeploy.

## 6. Update Paystack

In Paystack dashboard:

1. Set webhook URL:

```text
https://c59estatehub.com/api/billing/webhook
```

2. If Paystack asks for callback/redirect URL, use:

```text
https://c59estatehub.com/agents/dashboard#subscription
```

3. Keep test mode until checkout, callback, and webhook delivery are verified.

## 7. Final Verification

1. Open `https://c59estatehub.com`.
2. Confirm SSL is valid.
3. Confirm login and agent signup load Turnstile correctly.
4. Confirm listing detail pages generate canonical URLs with `https://c59estatehub.com`.
5. Confirm Paystack checkout redirects back to the custom domain.
6. Confirm Paystack webhook delivery returns `200`.
7. After everything works, you may remove old Vercel URL redirects from Supabase/Turnstile if you no longer need preview testing.
