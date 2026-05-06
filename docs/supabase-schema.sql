create extension if not exists pgcrypto;

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
  verification_documents text[] not null default '{}',
  is_blocked boolean not null default false,
  trial_ends_at timestamptz not null
);

create table if not exists public.subscriptions (
  agent_id uuid primary key references public.users (id) on delete cascade,
  trial_starts_at timestamptz not null,
  trial_ends_at timestamptz not null,
  is_active boolean not null default true
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
  contact_phone text not null,
  contact_whatsapp text not null,
  location jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.listings
  add column if not exists listing_category text not null default 'for_sale';

alter table public.listings
  add column if not exists availability text not null default 'available';

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
end $$;

create index if not exists listings_public_idx
  on public.listings (status, created_at desc);

create index if not exists listings_agent_idx
  on public.listings (agent_id, created_at desc);

create index if not exists listings_public_agent_idx
  on public.listings (agent_id, status, created_at desc);

create index if not exists agents_public_visibility_idx
  on public.agents (verification_status, is_blocked, id);

alter table public.users enable row level security;
alter table public.agents enable row level security;
alter table public.subscriptions enable row level security;
alter table public.listings enable row level security;

create policy "users can read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "users can update own row"
  on public.users for update
  using (auth.uid() = id);

create policy "agents can read own profile"
  on public.agents for select
  using (auth.uid() = id);

create policy "agents can update own docs"
  on public.agents for update
  using (auth.uid() = id);

create policy "agents can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = agent_id);

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
  with check (auth.uid() = agent_id);

create policy "agents can update own listings"
  on public.listings for update
  using (auth.uid() = agent_id);

create policy "agents can delete own listings"
  on public.listings for delete
  using (auth.uid() = agent_id);

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-documents',
  'verification-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
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

create policy "authenticated users can upload verification docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'verification-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'pdf')
  );

create policy "authenticated users can read own verification docs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'verification-documents' and auth.uid()::text = (storage.foldername(name))[1]);
