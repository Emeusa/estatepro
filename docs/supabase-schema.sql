create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.auth_email_exists(check_email text)
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(check_email)
  );
$$;

revoke all on function public.auth_email_exists(text) from public;
revoke all on function public.auth_email_exists(text) from anon;
revoke all on function public.auth_email_exists(text) from authenticated;
grant execute on function public.auth_email_exists(text) to service_role;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone text,
  role text not null check (role in ('client', 'agent', 'admin')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.agents (
  id uuid primary key references public.users (id) on delete cascade,
  verification_status text not null check (verification_status in ('pending', 'approved', 'rejected')),
  nin_number text,
  is_blocked boolean not null default false,
  trial_ends_at timestamptz not null
);

create table if not exists public.plans (
  slug text primary key,
  name text not null,
  monthly_price_naira integer,
  active_listing_limit integer,
  manual_boosts_monthly integer,
  auto_refresh_days integer,
  featured_credits_monthly integer,
  sponsored_slots_monthly integer,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscriptions (
  agent_id uuid primary key references public.users (id) on delete cascade,
  plan_slug text not null default 'free_starter',
  payment_provider text not null default 'paystack',
  billing_mode text not null default 'recurring',
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_email_token text,
  paystack_plan_code text,
  opay_order_no text,
  opay_transaction_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  status text not null default 'active',
  trial_starts_at timestamptz not null,
  trial_ends_at timestamptz not null,
  is_active boolean not null default true
);

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete cascade,
  reference text not null unique,
  plan_slug text not null references public.plans (slug),
  payment_provider text not null default 'paystack',
  billing_mode text not null default 'recurring',
  paystack_plan_code text,
  amount_kobo integer not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'abandoned')),
  authorization_url text,
  access_code text,
  paystack_transaction_id text,
  paystack_customer_code text,
  paystack_subscription_code text,
  opay_order_no text,
  opay_transaction_id text,
  raw_response jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  description text not null,
  price bigint not null,
  property_type text not null check (property_type in ('apartment', 'duplex', 'land', 'office', 'shop')),
  listing_category text not null default 'for_sale' check (listing_category in ('for_sale', 'for_rent', 'short_let')),
  availability text not null default 'available' check (availability in ('available', 'sold', 'rented', 'booked')),
  status text not null check (status in ('pending', 'active', 'blocked')),
  image_urls text[] not null default '{}',
  image_variants jsonb not null default '[]',
  promotion_type text not null default 'standard',
  boosted_at timestamptz,
  last_refreshed_at timestamptz,
  expires_at timestamptz,
  featured_until timestamptz,
  sponsored_until timestamptz,
  photos_verified_at timestamptz,
  contact_phone text not null,
  contact_whatsapp text not null,
  location jsonb not null,
  bedrooms integer,
  bathrooms integer,
  toilets integer,
  parking_spaces integer,
  property_size integer,
  property_size_unit text,
  year_built integer,
  floor_level integer,
  total_floors integer,
  furnishing_status text,
  servicing_status text,
  property_condition text,
  amenities jsonb,
  utilities jsonb,
  safety_features jsonb,
  nearby_landmarks jsonb,
  extra_features jsonb,
  land_size integer,
  land_size_unit text,
  title_document_type text,
  zoning_type text,
  road_access text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.promotion_credits (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete cascade,
  credit_type text not null check (credit_type in ('boost', 'featured', 'sponsored')),
  quantity integer not null check (quantity >= 0),
  remaining integer not null check (remaining >= 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.promotion_credit_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  credit_type text not null check (credit_type in ('boost', 'featured', 'sponsored')),
  action text not null,
  quantity integer not null check (quantity > 0),
  balance_after integer not null check (balance_after >= 0),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listing_promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  agent_id uuid not null references public.users (id) on delete cascade,
  promotion_type text not null check (promotion_type in ('premium', 'featured', 'sponsored', 'homepage')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listing_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  agent_id uuid references public.users (id) on delete set null,
  event_type text not null check (event_type in ('impression', 'detail_view', 'whatsapp_click', 'phone_click', 'save', 'report')),
  session_hash text,
  ip_hash text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_user_id uuid references public.users (id) on delete set null,
  reason text not null check (reason in ('fake', 'unavailable', 'duplicate', 'wrong_price', 'scam', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'resolved')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saved_listings (
  user_id uuid not null references public.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, listing_id)
);

create table if not exists public.agent_daily_metrics (
  agent_id uuid not null references public.users (id) on delete cascade,
  metric_date date not null,
  listing_views integer not null default 0 check (listing_views >= 0),
  detail_views integer not null default 0 check (detail_views >= 0),
  whatsapp_clicks integer not null default 0 check (whatsapp_clicks >= 0),
  phone_clicks integer not null default 0 check (phone_clicks >= 0),
  saves integer not null default 0 check (saves >= 0),
  reports integer not null default 0 check (reports >= 0),
  unique_viewers integer not null default 0 check (unique_viewers >= 0),
  primary key (agent_id, metric_date)
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete cascade,
  priority text not null default 'normal' check (priority in ('normal', 'priority', 'highest')),
  subject text not null check (char_length(subject) between 4 and 120),
  message text not null check (char_length(message) between 10 and 1200),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  route text not null,
  action text not null,
  result text not null check (result in ('allowed', 'blocked', 'failed', 'success')),
  user_id uuid references public.users (id) on delete set null,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  event_key text unique,
  email_type text not null check (
    email_type in (
      'welcome',
      'agent_registration_received',
      'agent_verification_approved',
      'agent_verification_rejected',
      'listing_active',
      'listing_rejected',
      'subscription_activated',
      'subscription_failed',
      'subscription_cancelled',
      'admin_alert'
    )
  ),
  recipient_email text not null,
  subject text not null,
  provider text not null default 'zoho',
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.agent_quota_overrides (
  agent_id uuid primary key references public.users (id) on delete cascade,
  daily_listing_limit integer not null default 20 check (daily_listing_limit between 0 and 500),
  hourly_image_limit integer not null default 30 check (hourly_image_limit between 0 and 1000),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.listings
  add column if not exists listing_category text not null default 'for_sale';

alter table public.listings
  add column if not exists availability text not null default 'available';

alter table public.listings
  add column if not exists image_variants jsonb not null default '[]';

alter table public.subscriptions
  add column if not exists plan_slug text not null default 'free_starter';

alter table public.subscriptions
  add column if not exists paystack_customer_code text,
  add column if not exists paystack_subscription_code text,
  add column if not exists paystack_email_token text,
  add column if not exists paystack_plan_code text,
  add column if not exists payment_provider text not null default 'paystack',
  add column if not exists billing_mode text not null default 'recurring',
  add column if not exists opay_order_no text,
  add column if not exists opay_transaction_id text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists status text not null default 'active';

alter table public.billing_transactions
  add column if not exists payment_provider text not null default 'paystack',
  add column if not exists billing_mode text not null default 'recurring',
  add column if not exists opay_order_no text,
  add column if not exists opay_transaction_id text;

alter table public.billing_transactions
  alter column paystack_plan_code drop not null;

update public.subscriptions
set payment_provider = coalesce(payment_provider, 'paystack'),
    billing_mode = coalesce(billing_mode, 'recurring');

update public.billing_transactions
set payment_provider = coalesce(payment_provider, 'paystack'),
    billing_mode = coalesce(billing_mode, 'recurring');

alter table public.listings
  add column if not exists promotion_type text not null default 'standard',
  add column if not exists boosted_at timestamptz,
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists featured_until timestamptz,
  add column if not exists sponsored_until timestamptz,
  add column if not exists photos_verified_at timestamptz;

alter table public.listings
  add column if not exists bedrooms integer,
  add column if not exists bathrooms integer,
  add column if not exists toilets integer,
  add column if not exists parking_spaces integer,
  add column if not exists property_size integer,
  add column if not exists property_size_unit text,
  add column if not exists year_built integer,
  add column if not exists floor_level integer,
  add column if not exists total_floors integer,
  add column if not exists furnishing_status text,
  add column if not exists servicing_status text,
  add column if not exists property_condition text,
  add column if not exists amenities jsonb,
  add column if not exists utilities jsonb,
  add column if not exists safety_features jsonb,
  add column if not exists nearby_landmarks jsonb,
  add column if not exists extra_features jsonb,
  add column if not exists land_size integer,
  add column if not exists land_size_unit text,
  add column if not exists title_document_type text,
  add column if not exists zoning_type text,
  add column if not exists road_access text;

alter table public.agents
  add column if not exists nin_number text;

insert into public.plans (
  slug,
  name,
  monthly_price_naira,
  active_listing_limit,
  manual_boosts_monthly,
  auto_refresh_days,
  featured_credits_monthly,
  sponsored_slots_monthly,
  is_active
)
values
  ('free_starter', 'Free Starter', 0, 3, 0, null, 0, 0, true),
  ('starter_agent', 'Starter Agent', 7500, 20, 5, 21, 0, 0, true),
  ('growth_agent', 'Growth Agent', 14900, 80, 20, 10, 5, 0, true),
  ('pro_agent', 'Pro Agent', 29900, 250, 60, 5, 20, 3, true),
  ('agency_plus', 'Agency Plus', 59900, 750, 150, 3, 50, 8, true),
  ('developer_enterprise', 'Developer / Enterprise', 100000, null, null, null, null, null, true)
on conflict (slug) do update set
  name = excluded.name,
  monthly_price_naira = excluded.monthly_price_naira,
  active_listing_limit = excluded.active_listing_limit,
  manual_boosts_monthly = excluded.manual_boosts_monthly,
  auto_refresh_days = excluded.auto_refresh_days,
  featured_credits_monthly = excluded.featured_credits_monthly,
  sponsored_slots_monthly = excluded.sponsored_slots_monthly,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'listings_listing_category_check'
  ) then
    alter table public.listings
      add constraint listings_listing_category_check
      check (listing_category in ('for_sale', 'for_rent', 'short_let'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'listings_availability_check'
  ) then
    alter table public.listings
      add constraint listings_availability_check
      check (availability in ('available', 'sold', 'rented', 'booked'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'agents_nin_number_check'
  ) then
    alter table public.agents
      add constraint agents_nin_number_check
      check (nin_number is null or nin_number ~ '^[0-9]{11}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'listings_quality_positive_check'
  ) then
    alter table public.listings
      add constraint listings_quality_positive_check
      check (
        (bedrooms is null or bedrooms between 1 and 100)
        and (bathrooms is null or bathrooms between 1 and 100)
        and (toilets is null or toilets between 1 and 100)
        and (parking_spaces is null or parking_spaces between 1 and 100)
        and (property_size is null or property_size between 1 and 10000000)
        and (year_built is null or year_built between 1800 and extract(year from now())::integer + 1)
        and (floor_level is null or floor_level between 1 and 300)
        and (total_floors is null or total_floors between 1 and 300)
        and (land_size is null or land_size between 1 and 10000000)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'listings_quality_enum_check'
  ) then
    alter table public.listings
      add constraint listings_quality_enum_check
      check (
        (property_size_unit is null or property_size_unit in ('sqm', 'sqft'))
        and (land_size_unit is null or land_size_unit in ('sqm', 'plots', 'acres', 'hectares'))
        and (furnishing_status is null or furnishing_status in ('unfurnished', 'semi_furnished', 'furnished'))
        and (servicing_status is null or servicing_status in ('unserviced', 'partly_serviced', 'serviced'))
        and (property_condition is null or property_condition in ('newly_built', 'renovated', 'fairly_used', 'needs_renovation'))
        and (title_document_type is null or title_document_type in ('certificate_of_occupancy', 'governors_consent', 'registered_survey', 'deed_of_assignment', 'excision', 'gazette', 'receipt', 'other'))
        and (zoning_type is null or zoning_type in ('residential', 'commercial', 'mixed_use', 'industrial', 'agricultural'))
        and (road_access is null or road_access in ('tarred', 'untarred', 'estate_road', 'major_road', 'none'))
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'listings_quality_json_array_check'
  ) then
    alter table public.listings
      add constraint listings_quality_json_array_check
      check (
        (amenities is null or jsonb_typeof(amenities) = 'array')
        and (utilities is null or jsonb_typeof(utilities) = 'array')
        and (safety_features is null or jsonb_typeof(safety_features) = 'array')
        and (nearby_landmarks is null or jsonb_typeof(nearby_landmarks) = 'array')
        and (extra_features is null or jsonb_typeof(extra_features) = 'array')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'listings_image_variants_check'
  ) then
    alter table public.listings
      add constraint listings_image_variants_check
      check (
        jsonb_typeof(image_variants) = 'array'
        and jsonb_array_length(image_variants) <= 10
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_plan_slug_fk'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_plan_slug_fk
      foreign key (plan_slug) references public.plans (slug);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_status_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_status_check
      check (status in ('trialing', 'active', 'past_due', 'cancelled', 'inactive'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_payment_provider_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_payment_provider_check
      check (payment_provider in ('paystack', 'opay'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_billing_mode_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_billing_mode_check
      check (billing_mode in ('recurring', 'prepaid'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'billing_transactions_payment_provider_check'
  ) then
    alter table public.billing_transactions
      add constraint billing_transactions_payment_provider_check
      check (payment_provider in ('paystack', 'opay'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'billing_transactions_billing_mode_check'
  ) then
    alter table public.billing_transactions
      add constraint billing_transactions_billing_mode_check
      check (billing_mode in ('recurring', 'prepaid'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'listings_promotion_type_check'
  ) then
    alter table public.listings
      add constraint listings_promotion_type_check
      check (promotion_type in ('standard', 'premium', 'featured', 'sponsored'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'listings_promotion_dates_check'
  ) then
    alter table public.listings
      add constraint listings_promotion_dates_check
      check (
        (featured_until is null or featured_until > created_at)
        and (sponsored_until is null or sponsored_until > created_at)
        and (expires_at is null or expires_at > created_at)
      );
  end if;
end $$;

create index if not exists listings_public_idx
  on public.listings (status, created_at desc);

create index if not exists listings_agent_idx
  on public.listings (agent_id, created_at desc);

create index if not exists listings_public_agent_idx
  on public.listings (agent_id, status, created_at desc);

create index if not exists listings_title_search_idx
  on public.listings using gin (title gin_trgm_ops);

create index if not exists listings_keyword_category_idx
  on public.listings (property_type, listing_category, status, created_at desc);

create index if not exists listings_feed_availability_idx
  on public.listings (availability, status, created_at desc);

create index if not exists listings_feed_category_idx
  on public.listings (availability, property_type, listing_category, status, created_at desc);

create index if not exists listings_location_state_idx
  on public.listings ((location->>'state'));

create index if not exists listings_location_city_idx
  on public.listings ((location->>'city'));

create index if not exists listings_location_slug_idx
  on public.listings ((location->>'slug'));

create index if not exists listings_feed_state_idx
  on public.listings (availability, status, (location->>'state'), created_at desc);

create index if not exists listings_feed_state_city_idx
  on public.listings (availability, status, (location->>'state'), (location->>'city'), created_at desc);

create index if not exists listings_feed_price_idx
  on public.listings (availability, status, price, created_at desc);

create index if not exists listings_feed_bedrooms_idx
  on public.listings (availability, status, bedrooms, created_at desc);

create index if not exists listings_feed_bathrooms_idx
  on public.listings (availability, status, bathrooms, created_at desc);

create index if not exists listings_feed_rooms_idx
  on public.listings (availability, status, bedrooms, bathrooms, created_at desc);

create index if not exists listings_feed_visibility_score_idx
  on public.listings (
    availability,
    status,
    promotion_type,
    sponsored_until desc,
    featured_until desc,
    boosted_at desc,
    last_refreshed_at desc,
    created_at desc
  );

create index if not exists listings_feed_expiry_idx
  on public.listings (availability, status, expires_at, created_at desc);

create index if not exists subscriptions_plan_idx
  on public.subscriptions (plan_slug, is_active);

create index if not exists subscriptions_provider_idx
  on public.subscriptions (payment_provider, billing_mode, is_active);

create index if not exists subscriptions_paystack_customer_idx
  on public.subscriptions (paystack_customer_code)
  where paystack_customer_code is not null;

create index if not exists subscriptions_paystack_subscription_idx
  on public.subscriptions (paystack_subscription_code)
  where paystack_subscription_code is not null;

create index if not exists subscriptions_opay_order_idx
  on public.subscriptions (opay_order_no)
  where opay_order_no is not null;

create index if not exists billing_transactions_agent_idx
  on public.billing_transactions (agent_id, created_at desc);

create index if not exists billing_transactions_status_idx
  on public.billing_transactions (status, created_at desc);

create index if not exists billing_transactions_provider_status_idx
  on public.billing_transactions (payment_provider, status, created_at desc);

create index if not exists billing_transactions_provider_mode_status_idx
  on public.billing_transactions (payment_provider, billing_mode, status, created_at desc);

create index if not exists billing_transactions_reference_idx
  on public.billing_transactions (reference);

create index if not exists billing_transactions_opay_order_idx
  on public.billing_transactions (opay_order_no)
  where opay_order_no is not null;

create index if not exists plans_active_idx
  on public.plans (is_active, monthly_price_naira);

create index if not exists promotion_credits_agent_idx
  on public.promotion_credits (agent_id, credit_type, period_end desc);

create unique index if not exists promotion_credits_period_unique_idx
  on public.promotion_credits (agent_id, credit_type, period_start, period_end);

create index if not exists promotion_credit_events_agent_idx
  on public.promotion_credit_events (agent_id, credit_type, created_at desc);

create index if not exists promotion_credit_events_listing_idx
  on public.promotion_credit_events (listing_id, created_at desc)
  where listing_id is not null;

create index if not exists listing_promotions_listing_idx
  on public.listing_promotions (listing_id, status, ends_at desc);

create index if not exists listing_promotions_agent_idx
  on public.listing_promotions (agent_id, promotion_type, status, ends_at desc);

create index if not exists listing_events_listing_idx
  on public.listing_events (listing_id, event_type, created_at desc);

create index if not exists listing_events_agent_idx
  on public.listing_events (agent_id, event_type, created_at desc);

create index if not exists listing_reports_listing_idx
  on public.listing_reports (listing_id, status, created_at desc);

create index if not exists listing_reports_status_idx
  on public.listing_reports (status, created_at desc);

create index if not exists saved_listings_user_created_idx
  on public.saved_listings (user_id, created_at desc);

create index if not exists saved_listings_listing_idx
  on public.saved_listings (listing_id);

create index if not exists agent_daily_metrics_date_idx
  on public.agent_daily_metrics (metric_date desc, agent_id);

create index if not exists support_requests_priority_idx
  on public.support_requests (priority, status, created_at desc);

create index if not exists support_requests_agent_idx
  on public.support_requests (agent_id, created_at desc);

create index if not exists agents_public_visibility_idx
  on public.agents (verification_status, is_blocked, id);

create unique index if not exists agents_nin_number_unique_idx
  on public.agents (nin_number)
  where nin_number is not null;

create index if not exists security_events_created_at_idx
  on public.security_events (created_at desc);

create index if not exists security_events_action_idx
  on public.security_events (action, created_at desc);

create index if not exists security_events_user_idx
  on public.security_events (user_id, created_at desc);

create index if not exists security_events_ip_hash_idx
  on public.security_events (ip_hash, created_at desc);

create index if not exists email_events_user_idx
  on public.email_events (user_id, created_at desc);

create index if not exists email_events_type_status_idx
  on public.email_events (email_type, status, created_at desc);

create index if not exists email_events_event_key_idx
  on public.email_events (event_key)
  where event_key is not null;

create index if not exists email_events_recipient_idx
  on public.email_events (recipient_email, created_at desc);

create or replace function public.grant_plan_promotion_credits(
  p_agent_id uuid,
  p_plan_slug text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  with plan_values as (
    select
      manual_boosts_monthly,
      featured_credits_monthly,
      sponsored_slots_monthly
    from public.plans
    where slug = p_plan_slug
      and is_active = true
  ),
  credits as (
    select 'boost'::text as credit_type, coalesce(manual_boosts_monthly, 0) as quantity from plan_values
    union all
    select 'featured'::text, coalesce(featured_credits_monthly, 0) from plan_values
    union all
    select 'sponsored'::text, coalesce(sponsored_slots_monthly, 0) from plan_values
  )
  insert into public.promotion_credits (
    agent_id,
    credit_type,
    quantity,
    remaining,
    period_start,
    period_end
  )
  select
    p_agent_id,
    credit_type,
    quantity,
    quantity,
    p_period_start,
    p_period_end
  from credits
  where quantity > 0
  on conflict (agent_id, credit_type, period_start, period_end)
  do update set
    remaining = public.promotion_credits.remaining
      + greatest(excluded.quantity - public.promotion_credits.quantity, 0),
    quantity = greatest(public.promotion_credits.quantity, excluded.quantity);
$$;

revoke all on function public.grant_plan_promotion_credits(uuid, text, timestamptz, timestamptz) from public;
revoke all on function public.grant_plan_promotion_credits(uuid, text, timestamptz, timestamptz) from anon;
revoke all on function public.grant_plan_promotion_credits(uuid, text, timestamptz, timestamptz) from authenticated;
grant execute on function public.grant_plan_promotion_credits(uuid, text, timestamptz, timestamptz) to service_role;

create or replace function public.consume_promotion_credit(
  p_agent_id uuid,
  p_credit_type text,
  p_listing_id uuid,
  p_action text,
  p_metadata jsonb default '{}'
)
returns table (credit_id uuid, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_credit record;
  new_remaining integer;
begin
  select pc.*
  into selected_credit
  from public.promotion_credits pc
  where pc.agent_id = p_agent_id
    and pc.credit_type = p_credit_type
    and pc.period_start <= timezone('utc', now())
    and pc.period_end > timezone('utc', now())
    and pc.remaining > 0
  order by pc.period_end asc
  for update skip locked
  limit 1;

  if not found then
    raise exception 'No % credits remaining for this billing period.', p_credit_type;
  end if;

  update public.promotion_credits pc
  set remaining = selected_credit.remaining - 1
  where pc.id = selected_credit.id
  returning pc.remaining into new_remaining;

  insert into public.promotion_credit_events (
    agent_id,
    listing_id,
    credit_type,
    action,
    quantity,
    balance_after,
    metadata
  )
  values (
    p_agent_id,
    p_listing_id,
    p_credit_type,
    p_action,
    1,
    new_remaining,
    coalesce(p_metadata, '{}')
  );

  credit_id := selected_credit.id;
  remaining := new_remaining;
  return next;
end;
$$;

revoke all on function public.consume_promotion_credit(uuid, text, uuid, text, jsonb) from public;
revoke all on function public.consume_promotion_credit(uuid, text, uuid, text, jsonb) from anon;
revoke all on function public.consume_promotion_credit(uuid, text, uuid, text, jsonb) from authenticated;
grant execute on function public.consume_promotion_credit(uuid, text, uuid, text, jsonb) to service_role;

create or replace function public.record_listing_event(
  p_listing_id uuid,
  p_event_type text,
  p_session_hash text default null,
  p_ip_hash text default null,
  p_metadata jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_agent_id uuid;
begin
  select listings.agent_id
  into listing_agent_id
  from public.listings
  join public.agents
    on agents.id = listings.agent_id
  where listings.id = p_listing_id
    and listings.status = 'active'
    and agents.verification_status = 'approved'
    and agents.is_blocked = false;

  if listing_agent_id is null then
    return;
  end if;

  insert into public.listing_events (
    listing_id,
    agent_id,
    event_type,
    session_hash,
    ip_hash,
    metadata
  )
  values (
    p_listing_id,
    listing_agent_id,
    p_event_type,
    p_session_hash,
    p_ip_hash,
    coalesce(p_metadata, '{}')
  );

  insert into public.agent_daily_metrics (
    agent_id,
    metric_date,
    listing_views,
    detail_views,
    whatsapp_clicks,
    phone_clicks,
    saves,
    reports,
    unique_viewers
  )
  values (
    listing_agent_id,
    timezone('utc', now())::date,
    case when p_event_type = 'impression' then 1 else 0 end,
    case when p_event_type = 'detail_view' then 1 else 0 end,
    case when p_event_type = 'whatsapp_click' then 1 else 0 end,
    case when p_event_type = 'phone_click' then 1 else 0 end,
    case when p_event_type = 'save' then 1 else 0 end,
    case when p_event_type = 'report' then 1 else 0 end,
    case when p_session_hash is not null then 1 else 0 end
  )
  on conflict (agent_id, metric_date)
  do update set
    listing_views = public.agent_daily_metrics.listing_views + excluded.listing_views,
    detail_views = public.agent_daily_metrics.detail_views + excluded.detail_views,
    whatsapp_clicks = public.agent_daily_metrics.whatsapp_clicks + excluded.whatsapp_clicks,
    phone_clicks = public.agent_daily_metrics.phone_clicks + excluded.phone_clicks,
    saves = public.agent_daily_metrics.saves + excluded.saves,
    reports = public.agent_daily_metrics.reports + excluded.reports,
    unique_viewers = public.agent_daily_metrics.unique_viewers + excluded.unique_viewers;
end;
$$;

revoke all on function public.record_listing_event(uuid, text, text, text, jsonb) from public;
revoke all on function public.record_listing_event(uuid, text, text, text, jsonb) from anon;
revoke all on function public.record_listing_event(uuid, text, text, text, jsonb) from authenticated;
grant execute on function public.record_listing_event(uuid, text, text, text, jsonb) to service_role;

create or replace view public.public_listings as
select listings.*
from public.listings
join public.agents
  on agents.id = listings.agent_id
where listings.status = 'active'
  and agents.verification_status = 'approved'
  and agents.is_blocked = false;

create or replace view public.public_feed_listings as
select listings.*
from public.listings
join public.agents
  on agents.id = listings.agent_id
where listings.status = 'active'
  and listings.availability = 'available'
  and (listings.expires_at is null or listings.expires_at > timezone('utc', now()))
  and (
    cardinality(listings.image_urls) > 0
    or jsonb_array_length(listings.image_variants) > 0
  )
  and agents.verification_status = 'approved'
  and agents.is_blocked = false;

alter table public.users enable row level security;
alter table public.agents enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_transactions enable row level security;
alter table public.listings enable row level security;
alter table public.promotion_credits enable row level security;
alter table public.promotion_credit_events enable row level security;
alter table public.listing_promotions enable row level security;
alter table public.listing_events enable row level security;
alter table public.listing_reports enable row level security;
alter table public.saved_listings enable row level security;
alter table public.agent_daily_metrics enable row level security;
alter table public.support_requests enable row level security;
alter table public.security_events enable row level security;
alter table public.email_events enable row level security;
alter table public.agent_quota_overrides enable row level security;

drop policy if exists "users can read own row" on public.users;
drop policy if exists "users can update own row" on public.users;
drop policy if exists "agents can read own profile" on public.agents;
drop policy if exists "agents can update own docs" on public.agents;
drop policy if exists "public can read active plans" on public.plans;
drop policy if exists "agents can read own subscription" on public.subscriptions;
drop policy if exists "admins can read subscriptions" on public.subscriptions;
drop policy if exists "admins can manage subscriptions" on public.subscriptions;
drop policy if exists "agents can read own billing transactions" on public.billing_transactions;
drop policy if exists "admins can read billing transactions" on public.billing_transactions;
drop policy if exists "public can read active listings" on public.listings;
drop policy if exists "agents can insert own listings" on public.listings;
drop policy if exists "agents can update own listings" on public.listings;
drop policy if exists "agents can delete own listings" on public.listings;
drop policy if exists "agents can read own promotion credits" on public.promotion_credits;
drop policy if exists "admins can manage promotion credits" on public.promotion_credits;
drop policy if exists "agents can read own promotion credit events" on public.promotion_credit_events;
drop policy if exists "admins can read promotion credit events" on public.promotion_credit_events;
drop policy if exists "agents can read own listing promotions" on public.listing_promotions;
drop policy if exists "admins can manage listing promotions" on public.listing_promotions;
drop policy if exists "agents can read own listing events" on public.listing_events;
drop policy if exists "admins can read listing events" on public.listing_events;
drop policy if exists "users can create listing reports" on public.listing_reports;
drop policy if exists "users can read own listing reports" on public.listing_reports;
drop policy if exists "admins can manage listing reports" on public.listing_reports;
drop policy if exists "users can read own saved listings" on public.saved_listings;
drop policy if exists "users can save own listings" on public.saved_listings;
drop policy if exists "users can remove own saved listings" on public.saved_listings;
drop policy if exists "admins can manage saved listings" on public.saved_listings;
drop policy if exists "agents can read own daily metrics" on public.agent_daily_metrics;
drop policy if exists "admins can read daily metrics" on public.agent_daily_metrics;
drop policy if exists "agents can create own support requests" on public.support_requests;
drop policy if exists "agents can read own support requests" on public.support_requests;
drop policy if exists "admins can manage support requests" on public.support_requests;
drop policy if exists "admins can read security events" on public.security_events;
drop policy if exists "admins can read email events" on public.email_events;
drop policy if exists "admins can read quota overrides" on public.agent_quota_overrides;
drop policy if exists "admins can manage quota overrides" on public.agent_quota_overrides;

create policy "users can read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "agents can read own profile"
  on public.agents for select
  using (auth.uid() = id);

create policy "public can read active plans"
  on public.plans for select
  using (is_active = true);

create policy "agents can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = agent_id);

create policy "admins can read subscriptions"
  on public.subscriptions for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "admins can manage subscriptions"
  on public.subscriptions for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "agents can read own billing transactions"
  on public.billing_transactions for select
  using (auth.uid() = agent_id);

create policy "admins can read billing transactions"
  on public.billing_transactions for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "public can read active listings"
  on public.listings for select
  using (
    auth.uid() = agent_id
    or (
      status = 'active'
      and exists (
        select 1
        from public.agents
        where agents.id = listings.agent_id
          and agents.verification_status = 'approved'
          and agents.is_blocked = false
      )
    )
  );

create policy "agents can insert own listings"
  on public.listings for insert
  with check (
    auth.uid() = agent_id
    and status = 'pending'
    and exists (
      select 1
      from public.agents
      where agents.id = listings.agent_id
        and agents.verification_status <> 'rejected'
        and agents.is_blocked = false
    )
  );

create policy "agents can update own listings"
  on public.listings for update
  using (
    auth.uid() = agent_id
    and exists (
      select 1
      from public.agents
      where agents.id = listings.agent_id
        and agents.verification_status <> 'rejected'
        and agents.is_blocked = false
    )
  )
  with check (
    auth.uid() = agent_id
    and status = 'pending'
    and exists (
      select 1
      from public.agents
      where agents.id = listings.agent_id
        and agents.verification_status <> 'rejected'
        and agents.is_blocked = false
    )
  );

create policy "agents can delete own listings"
  on public.listings for delete
  using (
    auth.uid() = agent_id
    and exists (
      select 1
      from public.agents
      where agents.id = listings.agent_id
        and agents.verification_status <> 'rejected'
        and agents.is_blocked = false
    )
  );

create policy "agents can read own promotion credits"
  on public.promotion_credits for select
  using (auth.uid() = agent_id);

create policy "admins can manage promotion credits"
  on public.promotion_credits for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "agents can read own promotion credit events"
  on public.promotion_credit_events for select
  using (auth.uid() = agent_id);

create policy "admins can read promotion credit events"
  on public.promotion_credit_events for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "agents can read own listing promotions"
  on public.listing_promotions for select
  using (auth.uid() = agent_id);

create policy "admins can manage listing promotions"
  on public.listing_promotions for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "agents can read own listing events"
  on public.listing_events for select
  using (auth.uid() = agent_id);

create policy "admins can read listing events"
  on public.listing_events for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "users can create listing reports"
  on public.listing_reports for insert
  with check (
    (reporter_user_id is null or reporter_user_id = auth.uid())
    and exists (
      select 1
      from public.listings
      join public.agents
        on agents.id = listings.agent_id
      where listings.id = listing_reports.listing_id
        and listings.status = 'active'
        and agents.verification_status = 'approved'
        and agents.is_blocked = false
    )
  );

create policy "users can read own listing reports"
  on public.listing_reports for select
  using (reporter_user_id = auth.uid());

create policy "admins can manage listing reports"
  on public.listing_reports for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "users can read own saved listings"
  on public.saved_listings for select
  using (auth.uid() = user_id);

create policy "users can save own listings"
  on public.saved_listings for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.listings
      join public.agents
        on agents.id = listings.agent_id
      where listings.id = saved_listings.listing_id
        and listings.status = 'active'
        and agents.verification_status = 'approved'
        and agents.is_blocked = false
    )
  );

create policy "users can remove own saved listings"
  on public.saved_listings for delete
  using (auth.uid() = user_id);

create policy "admins can manage saved listings"
  on public.saved_listings for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "agents can read own daily metrics"
  on public.agent_daily_metrics for select
  using (auth.uid() = agent_id);

create policy "admins can read daily metrics"
  on public.agent_daily_metrics for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "agents can create own support requests"
  on public.support_requests for insert
  with check (auth.uid() = agent_id);

create policy "agents can read own support requests"
  on public.support_requests for select
  using (auth.uid() = agent_id);

create policy "admins can manage support requests"
  on public.support_requests for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "admins can read security events"
  on public.security_events for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "admins can read email events"
  on public.email_events for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "admins can read quota overrides"
  on public.agent_quota_overrides for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

create policy "admins can manage quota overrides"
  on public.agent_quota_overrides for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users can upload listing images" on storage.objects;
drop policy if exists "public can view listing images" on storage.objects;
drop policy if exists "authenticated users can upload verification docs" on storage.objects;
drop policy if exists "authenticated users can read own verification docs" on storage.objects;

create policy "authenticated users can upload listing images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and auth.uid()::text = (storage.foldername(name))[1]
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy "public can view listing images"
  on storage.objects for select
  using (bucket_id = 'listing-images');

-- One-time repair for pending listings created before approved-agent auto-activation:
-- update public.listings
-- set status = 'active',
--     updated_at = timezone('utc', now())
-- from public.agents
-- where agents.id = listings.agent_id
--   and agents.verification_status = 'approved'
--   and agents.is_blocked = false
--   and listings.status = 'pending';

-- One-time repair for known listing title typos created before expanded title normalization:
-- update public.listings
-- set title = regexp_replace(title, '\ytree\y', 'three', 'gi'),
--     updated_at = timezone('utc', now())
-- where title ~* '\ytree\y';
--
-- update public.listings
-- set title = regexp_replace(title, '\yapartmemts\y', 'apartments', 'gi'),
--     updated_at = timezone('utc', now())
-- where title ~* '\yapartmemts\y';
--
-- update public.listings
-- set title = regexp_replace(title, '\yapartmemt\y', 'apartment', 'gi'),
--     updated_at = timezone('utc', now())
-- where title ~* '\yapartmemt\y';
