# C59 Estatehub Email System Setup

The app uses two email paths:

- Supabase Auth sends confirmation, password reset, email change, and magic-link emails.
- The app sends transactional product emails through Zoho SMTP.

Do not use Zoho Mail SMTP for high-volume cold outreach. Use Zoho Campaigns or another campaign platform for bulk marketing so unsubscribe, bounce, and spam-compliance handling are stronger.

## 1. Zoho Mail Setup

1. In Zoho Mail, create sender mailboxes such as:
   - `no-reply@c59estatehub.com`
   - `support@c59estatehub.com`
   - `outreach@c59estatehub.com` if needed later
2. Confirm the mailbox can send email from Zoho webmail.
3. Confirm DNS records for `c59estatehub.com`:
   - MX records point to Zoho.
   - SPF includes Zoho.
   - DKIM is enabled in Zoho and published in DNS.
   - DMARC is present. Start with monitoring if unsure.
4. If 2FA is enabled on the sender mailbox, generate a Zoho app-specific password.

## 2. Supabase Auth SMTP

In Supabase Dashboard:

1. Open `Authentication` -> `URL Configuration`.
2. Set Site URL:
   ```text
   https://c59estatehub.com
   ```
3. Add redirect URLs:
   ```text
   https://c59estatehub.com/login
   https://c59estatehub.com/auth/reset-password
   https://c59estatehub.com/dashboard
   https://c59estatehub.com/agents/dashboard
   http://localhost:3000/login
   http://localhost:3000/auth/reset-password
   http://localhost:3000/dashboard
   http://localhost:3000/agents/dashboard
   ```
4. Open `Authentication` -> `SMTP Settings`.
5. Configure Zoho SMTP:
   ```text
   Host: smtppro.zoho.com
   Port: 465
   Username: no-reply@c59estatehub.com
   Password: Zoho mailbox password or app-specific password
   Sender email: no-reply@c59estatehub.com
   Sender name: C59 Estatehub
   ```
6. Send Supabase's SMTP test email.
7. Customize Supabase email templates for:
   - Confirm signup
   - Reset password
   - Change email

## 3. Vercel Env Vars

Add these in Vercel for Production and Preview:

```env
ZOHO_SMTP_HOST=smtppro.zoho.com
ZOHO_SMTP_PORT=465
ZOHO_SMTP_SECURE=true
ZOHO_SMTP_USER=no-reply@c59estatehub.com
ZOHO_SMTP_PASSWORD=your_zoho_app_password
APP_EMAIL_FROM=no-reply@c59estatehub.com
APP_EMAIL_FROM_NAME=C59 Estatehub
ADMIN_ALERT_EMAIL=admin@c59estatehub.com
```

Redeploy after adding or changing env vars.

## 4. Supabase SQL

Run the latest `docs/supabase-schema.sql` in Supabase SQL Editor before relying on transactional email logs.

The schema adds:

- `public.auth_email_exists(check_email text)` so the server can detect Supabase Auth-only duplicate emails before sending another confirmation email
- `public.email_events`
- admin-only read policy for email events
- indexes for email status, type, recipient, and idempotency keys

## 5. Orphan Auth User Troubleshooting

Supabase Auth users and the app's `public.users` table are separate. If a registration attempt creates an Auth user but the app profile insert fails, the email may exist in `Authentication -> Users` while missing from `public.users`.

To fix a test orphan:

1. Open Supabase Dashboard -> `Authentication` -> `Users`.
2. Search for the email.
3. If it is a failed test account with no matching `public.users` row, delete the Auth user and register again.
4. If it is a real user, repair the missing `public.users` row manually instead of deleting the Auth user.

The app now checks both `public.users.email` and `auth.users.email` before signup, so these orphan records should return a clear duplicate-email message instead of sending another confirmation email.

## 6. Manual Tests

1. Register a client account.
2. Confirm the UI redirects to `/auth/check-email`.
3. Confirm the Supabase confirmation email arrives.
4. Try logging in before confirmation; it should say to confirm email.
5. Confirm the email, then log in.
6. Confirm the welcome email sends once.
7. Register an agent and confirm the registration-received email arrives.
8. Approve/reject the agent in admin and confirm the status email arrives.
9. Moderate a listing and confirm the listing status email arrives.
10. Complete a Paystack subscription or prepaid transfer payment and confirm the subscription email arrives.

If emails do not send, check `public.email_events` for `failed` or `skipped` status.
