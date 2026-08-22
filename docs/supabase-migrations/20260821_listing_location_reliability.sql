-- Focused, rerunnable migration for canonical listing areas and taxonomy.
-- This migration never deletes listings and never changes public listing slugs.

create table if not exists public.seo_area_redirects (
  id uuid primary key default gen_random_uuid(),
  old_state text not null,
  old_city text not null,
  old_slug text not null check (old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  area_id uuid not null references public.seo_areas (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (old_state, old_city, old_slug)
);

create index if not exists seo_area_redirects_area_id_idx
  on public.seo_area_redirects (area_id);

alter table public.seo_area_redirects enable row level security;
revoke all on public.seo_area_redirects from anon, authenticated;
grant select, insert, update, delete on public.seo_area_redirects to service_role;

insert into public.seo_areas (state, city, canonical_name, slug, aliases)
values
  ('Lagos', 'Eti-Osa', 'Ajah', 'ajah', array['ajah lekki']),
  ('Lagos', 'Eti-Osa', 'Sangotedo', 'sangotedo', array['sangotedo ajah', 'sangotedo-ajah', 'lekki phase 2 sangotedo']),
  ('Lagos', 'Eti-Osa', 'Banana Island', 'banana-island', array['banana island ikoyi']),
  ('Lagos', 'Eti-Osa', 'Carlton Gate Estate', 'carlton-gate-estate', array['carlton gate', 'carlton gate chevron']),
  ('Lagos', 'Eti-Osa', 'Chevron', 'chevron', array['chevron drive', 'chevron lekki']),
  ('Lagos', 'Eti-Osa', 'Orchid Road', 'orchid-road', array['orchid road chevron']),
  ('Lagos', 'Eti-Osa', 'Lekki Phase 1', 'lekki-phase-1', array['lekki phase one']),
  ('Lagos', 'Eti-Osa', 'Lekki Phase 2', 'lekki-phase-2', array['lekki phase two']),
  ('Lagos', 'Eti-Osa', 'Victoria Island', 'victoria-island', array['vi lagos'])
on conflict (state, city, slug) do update set
  canonical_name = excluded.canonical_name,
  aliases = excluded.aliases,
  updated_at = timezone('utc', now());

with normalized_lagos_areas as (
  select
    id,
    case lower(coalesce(area_slug, location->>'areaSlug', ''))
      when 'sangotedo' then 'sangotedo'
      when 'sangotedo-ajah' then 'sangotedo'
      when 'lekki-phase-2-sangotedo' then 'sangotedo'
      when 'ajah' then 'ajah'
      when 'banana-island' then 'banana-island'
      when 'carlton-gate' then 'carlton-gate-estate'
      when 'carlton-gate-estate' then 'carlton-gate-estate'
      when 'chevron-drive' then 'chevron'
      when 'chevron' then 'chevron'
      when 'orchid-road-chevron' then 'orchid-road'
      when 'orchid-road' then 'orchid-road'
      when 'lekki-phase-1' then 'lekki-phase-1'
      when 'lekki-phase-2' then 'lekki-phase-2'
      when 'victoria-island' then 'victoria-island'
      else null
    end as canonical_area_slug
  from public.listings
  where lower(location->>'state') = 'lagos'
), redirect_candidates as (
  select
    'Lagos'::text as old_state,
    listings.location->>'city' as old_city,
    trim(both '-' from regexp_replace(
      lower(coalesce(listings.area_slug, listings.location->>'areaSlug')),
      '[^a-z0-9]+',
      '-',
      'g'
    )) as old_slug,
    areas.id as area_id
  from public.listings as listings
  join normalized_lagos_areas as normalized on normalized.id = listings.id
  join public.seo_areas as areas
    on areas.state = 'Lagos'
    and areas.city = 'Eti-Osa'
    and areas.slug = normalized.canonical_area_slug
  where normalized.canonical_area_slug is not null
    and coalesce(listings.location->>'city', '') <> ''
    and coalesce(listings.area_slug, listings.location->>'areaSlug', '') <> ''
    and (
      listings.location->>'city' is distinct from 'Eti-Osa'
      or coalesce(listings.area_slug, listings.location->>'areaSlug') is distinct from normalized.canonical_area_slug
    )
)
insert into public.seo_area_redirects (old_state, old_city, old_slug, area_id)
select distinct on (old_state, old_city, old_slug)
  old_state,
  old_city,
  old_slug,
  area_id
from redirect_candidates
where old_slug <> ''
order by old_state, old_city, old_slug, area_id
on conflict (old_state, old_city, old_slug) do update set area_id = excluded.area_id;

with normalized_slugs as (
  select
    id,
    nullif(
      trim(both '-' from regexp_replace(
        lower(coalesce(location->>'area', area_slug, '')),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ) as normalized_slug
  from public.listings
), valid_normalized_slugs as (
  select id, normalized_slug
  from normalized_slugs
  where normalized_slug is not null
)
update public.listings as listings
set
  area_slug = normalized.normalized_slug,
  location = jsonb_set(
    coalesce(listings.location, '{}'::jsonb),
    '{areaSlug}',
    to_jsonb(normalized.normalized_slug),
    true
  )
from valid_normalized_slugs as normalized
where listings.id = normalized.id
  and (
    listings.area_slug is distinct from normalized.normalized_slug
    or listings.location->>'areaSlug' is distinct from normalized.normalized_slug
  );

update public.listings
set property_type = case
  when property_subtype in ('flat_apartment', 'mini_flat', 'self_contain', 'studio_apartment', 'shared_apartment', 'serviced_apartment', 'maisonette', 'penthouse', 'block_of_flats') then 'apartment'
  when property_subtype in ('duplex', 'detached_duplex', 'semi_detached_duplex', 'terraced_duplex', 'bungalow', 'detached_bungalow', 'semi_detached_bungalow', 'terraced_bungalow', 'terrace_house', 'townhouse', 'mansion', 'villa') then 'house'
  when property_subtype in ('single_room', 'room_and_parlour', 'boys_quarters', 'shared_room') then 'room'
  when property_subtype in ('residential_land', 'commercial_land', 'industrial_land', 'mixed_use_land', 'agricultural_land', 'joint_venture_land', 'waterfront_land', 'estate_plot', 'other_land') then 'land'
  when property_subtype in ('office', 'private_office', 'coworking_space', 'workstation', 'conference_room', 'shop', 'showroom', 'plaza_mall_complex', 'warehouse', 'factory', 'filling_station', 'event_hall', 'hotel', 'guest_house', 'resort', 'restaurant_bar', 'school', 'hospital_clinic', 'religious_property', 'commercial_building', 'other_commercial') then 'commercial'
  else property_type
end
where property_subtype is not null;

alter table public.listings
  drop constraint if exists listings_property_type_check,
  drop constraint if exists listings_property_taxonomy_match_check;

alter table public.listings
  add constraint listings_property_type_check
    check (property_type in ('apartment', 'house', 'room', 'land', 'commercial')),
  add constraint listings_property_taxonomy_match_check
    check (
      property_subtype is null
      or (property_type = 'apartment' and property_subtype in ('flat_apartment', 'mini_flat', 'self_contain', 'studio_apartment', 'shared_apartment', 'serviced_apartment', 'maisonette', 'penthouse', 'block_of_flats'))
      or (property_type = 'house' and property_subtype in ('duplex', 'detached_duplex', 'semi_detached_duplex', 'terraced_duplex', 'bungalow', 'detached_bungalow', 'semi_detached_bungalow', 'terraced_bungalow', 'terrace_house', 'townhouse', 'mansion', 'villa'))
      or (property_type = 'room' and property_subtype in ('single_room', 'room_and_parlour', 'boys_quarters', 'shared_room'))
      or (property_type = 'land' and property_subtype in ('residential_land', 'commercial_land', 'industrial_land', 'mixed_use_land', 'agricultural_land', 'joint_venture_land', 'waterfront_land', 'estate_plot', 'other_land'))
      or (property_type = 'commercial' and property_subtype in ('office', 'private_office', 'coworking_space', 'workstation', 'conference_room', 'shop', 'showroom', 'plaza_mall_complex', 'warehouse', 'factory', 'filling_station', 'event_hall', 'hotel', 'guest_house', 'resort', 'restaurant_bar', 'school', 'hospital_clinic', 'religious_property', 'commercial_building', 'other_commercial'))
    );
