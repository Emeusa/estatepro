import { toNameCase } from "@/lib/format";
import { resolveKnownNigeriaArea } from "@/data/nigeria-known-areas";
import { normalizeNigeriaLga, normalizeNigeriaState } from "@/lib/nigeria-locations";
import { sanitizeText, slugifyLocation } from "@/lib/sanitize";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { LocationValue, SeoAreaRecord } from "@/lib/types";

type SeoAreaRow = {
  id: string;
  state: string;
  city: string;
  canonical_name: string;
  slug: string;
  aliases: string[] | null;
  created_at: string;
  updated_at: string;
};

function isMissingAreaSchema(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01"
    || error?.code === "PGRST205"
    || /(seo_areas|seo_area_redirects).*(does not exist|schema cache)/i.test(error?.message ?? "");
}

function toSeoAreaRecord(row: SeoAreaRow): SeoAreaRecord {
  return {
    id: row.id,
    state: row.state,
    city: row.city,
    canonicalName: row.canonical_name,
    slug: row.slug,
    aliases: row.aliases ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function matchesArea(row: SeoAreaRow, slug: string) {
  return row.slug === slug || (row.aliases ?? []).some((alias) => slugifyLocation([alias]) === slug);
}

export async function listSeoAreas(state?: string): Promise<SeoAreaRecord[]> {
  const supabase = createServerSupabaseClient();
  const rows: SeoAreaRow[] = [];
  const canonicalState = state ? normalizeNigeriaState(state) : null;
  for (let from = 0; from < 10000; from += 1000) {
    let query = supabase
      .from("seo_areas")
      .select("id, state, city, canonical_name, slug, aliases, created_at, updated_at")
      .order("state", { ascending: true })
      .order("city", { ascending: true })
      .order("slug", { ascending: true })
      .range(from, from + 999);
    if (canonicalState) query = query.eq("state", canonicalState);
    const { data, error } = await query;
    if (error) {
      if (isMissingAreaSchema(error)) return [];
      throw new Error(error.message);
    }
    const batch = (data ?? []) as SeoAreaRow[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows.map(toSeoAreaRecord);
}

async function findAreaRedirect(state: string, city: string, slug: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("seo_area_redirects")
    .select("area_id")
    .eq("old_state", state)
    .eq("old_city", city)
    .eq("old_slug", slug)
    .maybeSingle();
  if (error) {
    if (isMissingAreaSchema(error)) return null;
    throw new Error(error.message);
  }
  if (!data?.area_id) return null;
  const { data: area, error: areaError } = await supabase
    .from("seo_areas")
    .select("id, state, city, canonical_name, slug, aliases, created_at, updated_at")
    .eq("id", data.area_id)
    .maybeSingle();
  if (areaError) throw new Error(areaError.message);
  return area ? toSeoAreaRecord(area as SeoAreaRow) : null;
}

export async function resolveSeoArea(state: string, city: string, area: string) {
  const canonicalState = normalizeNigeriaState(state);
  const canonicalCity = normalizeNigeriaLga(canonicalState, city);
  const slug = slugifyLocation([area]);
  const rows = (await listSeoAreas(canonicalState)).map((record) => ({
    id: record.id,
    state: record.state,
    city: record.city,
    canonical_name: record.canonicalName,
    slug: record.slug,
    aliases: record.aliases,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  }));
  const sameLga = rows.find((row) => row.city === canonicalCity && matchesArea(row, slug));
  if (sameLga) return toSeoAreaRecord(sameLga);

  const stateMatches = rows.filter((row) => matchesArea(row, slug));
  if (stateMatches.length === 1) return toSeoAreaRecord(stateMatches[0]);
  return findAreaRedirect(canonicalState, canonicalCity, slug);
}

export async function resolveOrRegisterSeoArea(location: LocationValue) {
  const state = normalizeNigeriaState(location.state);
  const selectedCity = normalizeNigeriaLga(state, location.city);
  const requestedSlug = slugifyLocation([location.areaSlug ?? location.area]);
  const knownArea = resolveKnownNigeriaArea(state, requestedSlug);
  const lookupCity = knownArea?.city ?? selectedCity;
  const lookupSlug = knownArea?.slug ?? requestedSlug;
  const existing = knownArea
    ? await resolveSeoArea(state, lookupCity, lookupSlug)
    : (await listSeoAreas(state)).find((area) =>
        area.city === selectedCity
        && [area.slug, ...area.aliases.map((alias) => slugifyLocation([alias]))].includes(requestedSlug)
      ) ?? null;
  if (existing) {
    return {
      ...location,
      state: existing.state,
      city: existing.city,
      areaSlug: existing.slug,
      slug: slugifyLocation([existing.state, existing.city, location.area])
    };
  }

  const canonicalName = knownArea?.canonicalName ?? toNameCase(sanitizeText(location.area));
  const slug = knownArea?.slug ?? slugifyLocation([canonicalName]);
  const city = knownArea?.city ?? selectedCity;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("seo_areas")
    .upsert({
      state,
      city,
      canonical_name: canonicalName,
      slug,
      aliases: knownArea?.aliases ?? []
    }, { onConflict: "state,city,slug", ignoreDuplicates: true })
    .select("id, state, city, canonical_name, slug, aliases, created_at, updated_at")
    .maybeSingle();

  if (error) {
    if (isMissingAreaSchema(error)) {
      return { ...location, state, city, areaSlug: slug };
    }
    throw new Error(error.message);
  }

  const registered = data
    ? toSeoAreaRecord(data as SeoAreaRow)
    : await resolveSeoArea(state, city, slug);
  return {
    ...location,
    state,
    city: registered?.city ?? city,
    areaSlug: registered?.slug ?? slug,
    slug: slugifyLocation([state, registered?.city ?? city, location.area])
  };
}

async function createAreaRedirect(area: SeoAreaRecord, targetAreaId = area.id) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("seo_area_redirects").upsert({
    old_state: area.state,
    old_city: area.city,
    old_slug: area.slug,
    area_id: targetAreaId
  }, { onConflict: "old_state,old_city,old_slug" });
  if (error && !isMissingAreaSchema(error)) throw new Error(error.message);
}

async function updateListingsForArea(source: SeoAreaRecord, target: SeoAreaRecord) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, location")
    .eq("location->>state", source.state)
    .eq("location->>city", source.city)
    .eq("area_slug", source.slug)
    .limit(5000);
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const listing of data ?? []) {
    const current = (listing.location ?? {}) as Record<string, unknown>;
    const location = {
      ...current,
      state: target.state,
      city: target.city,
      areaSlug: target.slug,
      slug: slugifyLocation([target.state, target.city, String(current.area ?? target.canonicalName)])
    };
    const { error: updateError } = await supabase
      .from("listings")
      .update({ location, area_slug: target.slug })
      .eq("id", listing.id);
    if (updateError) throw new Error(updateError.message);
    updated += 1;
  }
  return updated;
}

export async function moveSeoArea(areaId: string, state: string, city: string) {
  const areas = await listSeoAreas();
  const source = areas.find((area) => area.id === areaId);
  if (!source) throw new Error("SEO area was not found.");
  const targetState = normalizeNigeriaState(state);
  const targetCity = normalizeNigeriaLga(targetState, city);
  await createAreaRedirect(source);
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("seo_areas")
    .update({ state: targetState, city: targetCity, updated_at: new Date().toISOString() })
    .eq("id", areaId)
    .select("id, state, city, canonical_name, slug, aliases, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  const target = toSeoAreaRecord(data as SeoAreaRow);
  const updatedListings = await updateListingsForArea(source, target);
  return { area: target, updatedListings };
}

export async function mergeSeoAreas(sourceAreaId: string, targetAreaId: string) {
  if (sourceAreaId === targetAreaId) throw new Error("Select two different areas to merge.");
  const areas = await listSeoAreas();
  const source = areas.find((area) => area.id === sourceAreaId);
  const target = areas.find((area) => area.id === targetAreaId);
  if (!source || !target) throw new Error("One of the SEO areas was not found.");
  await createAreaRedirect(source, target.id);
  const supabase = createServerSupabaseClient();
  const aliases = Array.from(new Set([
    ...target.aliases,
    source.canonicalName,
    source.slug,
    ...source.aliases
  ])).filter((alias) => slugifyLocation([alias]) !== target.slug);
  const { data, error } = await supabase
    .from("seo_areas")
    .update({ aliases, updated_at: new Date().toISOString() })
    .eq("id", target.id)
    .select("id, state, city, canonical_name, slug, aliases, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  const updatedTarget = toSeoAreaRecord(data as SeoAreaRow);
  const updatedListings = await updateListingsForArea(source, updatedTarget);
  const { error: deleteError } = await supabase.from("seo_areas").delete().eq("id", source.id);
  if (deleteError) throw new Error(deleteError.message);
  return { area: updatedTarget, updatedListings };
}

export function findCrossLgaAreaConflicts(areas: SeoAreaRecord[]) {
  const groups = new Map<string, SeoAreaRecord[]>();
  for (const area of areas) {
    const key = `${area.state}|${area.slug}`;
    groups.set(key, [...(groups.get(key) ?? []), area]);
  }
  return [...groups.values()].filter((group) => new Set(group.map((area) => area.city)).size > 1);
}

export async function reconcileSeoAreaRegistry() {
  const supabase = createServerSupabaseClient();
  const listings: Array<{ id: string; location: LocationValue; area_slug: string | null }> = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, location, area_slug")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Array<{ id: string; location: LocationValue; area_slug: string | null }>;
    listings.push(...batch);
    if (batch.length < 1000) break;
  }

  let registeredOrNormalized = 0;
  for (const listing of listings) {
    if (!listing.location?.state || !listing.location.city || !listing.location.area) continue;
    const normalized = await resolveOrRegisterSeoArea(listing.location);
    const currentAreaSlug = listing.area_slug ?? listing.location.areaSlug ?? slugifyLocation([listing.location.area]);
    if (
      normalized.state === listing.location.state
      && normalized.city === listing.location.city
      && normalized.areaSlug === currentAreaSlug
    ) continue;
    const { error } = await supabase
      .from("listings")
      .update({ location: normalized, area_slug: normalized.areaSlug })
      .eq("id", listing.id);
    if (error) throw new Error(error.message);
    registeredOrNormalized += 1;
  }

  const areas = await listSeoAreas();
  const conflicts = findCrossLgaAreaConflicts(areas);
  if (conflicts.length) {
    const { error } = await supabase.from("admin_notifications").upsert({
      type: "seo_location_conflict",
      title: "SEO location conflicts need review",
      message: `${conflicts.length} area name${conflicts.length === 1 ? " appears" : "s appear"} under more than one LGA. Review and merge only genuine duplicates.`,
      priority: "normal",
      entity_type: "seo_area",
      href: "/admin/seo",
      dedupe_key: "seo-location-cross-lga-conflicts",
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString()
    }, { onConflict: "dedupe_key" });
    if (error) throw new Error(error.message);
  }
  return {
    areas: areas.length,
    normalizedListings: registeredOrNormalized,
    crossLgaConflicts: conflicts.length
  };
}
