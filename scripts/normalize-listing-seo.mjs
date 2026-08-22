import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const root = process.cwd();
const [states, lgas, aliases] = await Promise.all([
  readFile(path.join(root, "src/data/nigeria-states.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "src/data/nigeria-lgas.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "src/data/nigeria-location-aliases.json"), "utf8").then(JSON.parse)
]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function key(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function titleCase(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const stateMap = new Map(states.map((state) => [key(state), state]));
for (const [alias, state] of Object.entries(aliases.stateAliases)) stateMap.set(key(alias), state);
const lgaMaps = new Map(states.map((state) => [state, new Map(lgas[state].map((city) => [key(city), city]))]));
for (const [state, stateAliases] of Object.entries(aliases.lgaAliases)) {
  for (const [alias, city] of Object.entries(stateAliases)) lgaMaps.get(state)?.set(key(alias), city);
}

const subtypeGroups = {
  apartment: ["flat_apartment", "mini_flat", "self_contain", "studio_apartment", "shared_apartment", "serviced_apartment", "maisonette", "penthouse", "block_of_flats"],
  house: ["duplex", "detached_duplex", "semi_detached_duplex", "terraced_duplex", "bungalow", "detached_bungalow", "semi_detached_bungalow", "terraced_bungalow", "terrace_house", "townhouse", "mansion", "villa"],
  room: ["single_room", "room_and_parlour", "boys_quarters", "shared_room"],
  land: ["residential_land", "commercial_land", "industrial_land", "mixed_use_land", "agricultural_land", "joint_venture_land", "waterfront_land", "estate_plot", "other_land"],
  commercial: ["office", "private_office", "coworking_space", "workstation", "conference_room", "shop", "showroom", "plaza_mall_complex", "warehouse", "factory", "filling_station", "event_hall", "hotel", "guest_house", "resort", "restaurant_bar", "school", "hospital_clinic", "religious_property", "commercial_building", "other_commercial"]
};
const subtypeGroup = new Map(Object.entries(subtypeGroups).flatMap(([group, subtypes]) => subtypes.map((subtype) => [subtype, group])));
const inferenceRules = [
  [/\bsemi[ -]?detached[ -]+duplex\b/i, "semi_detached_duplex"],
  [/\bsemi[ -]?detached\b/i, "semi_detached_duplex"],
  [/\bterrace(d)?[ -]+duplex\b/i, "terraced_duplex"],
  [/\bdetached[ -]+duplex\b/i, "detached_duplex"],
  [/\bfully[ -]+detached\b/i, "detached_duplex"],
  [/\bmini[ -]?flat\b/i, "mini_flat"],
  [/\bself[ -]?contain(ed)?\b/i, "self_contain"],
  [/\broom[ -]+and[ -]+parlour\b/i, "room_and_parlour"],
  [/\bduplex\b/i, "duplex"],
  [/\bbungalow\b/i, "bungalow"],
  [/\bwarehouse\b/i, "warehouse"],
  [/\bfactory\b/i, "factory"],
  [/\bhotel\b/i, "hotel"]
];

async function readAll(table, columns) {
  const rows = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

const listings = await readAll("listings", "id, slug, title, description, property_type, property_subtype, location, area_slug");
let seoAreas = [];
const areaResult = await supabase.from("seo_areas").select("id, state, city, canonical_name, slug, aliases").limit(10000);
if (!areaResult.error) seoAreas = areaResult.data ?? [];

const builtInAreas = [
  ["Lagos", "Eti-Osa", "Ajah", "ajah", ["ajah lekki"]],
  ["Lagos", "Eti-Osa", "Sangotedo", "sangotedo", ["sangotedo ajah", "sangotedo-ajah", "lekki phase 2 sangotedo"]],
  ["Lagos", "Eti-Osa", "Banana Island", "banana-island", ["banana island ikoyi"]],
  ["Lagos", "Eti-Osa", "Carlton Gate Estate", "carlton-gate-estate", ["carlton gate", "carlton gate chevron"]],
  ["Lagos", "Eti-Osa", "Chevron", "chevron", ["chevron drive", "chevron lekki"]],
  ["Lagos", "Eti-Osa", "Orchid Road", "orchid-road", ["orchid road chevron"]],
  ["Lagos", "Eti-Osa", "Lekki Phase 1", "lekki-phase-1", ["lekki phase one"]],
  ["Lagos", "Eti-Osa", "Lekki Phase 2", "lekki-phase-2", ["lekki phase two"]],
  ["Lagos", "Eti-Osa", "Victoria Island", "victoria-island", ["vi lagos"]]
].map(([state, city, canonical_name, slug, areaAliases]) => ({ state, city, canonical_name, slug, aliases: areaAliases }));
seoAreas = [...seoAreas, ...builtInAreas.filter((builtIn) => !seoAreas.some((area) => area.state === builtIn.state && area.city === builtIn.city && area.slug === builtIn.slug))];

function resolveArea(state, city, area, areaSlug) {
  const slug = key(areaSlug || area);
  const builtInMatches = builtInAreas.filter((entry) => entry.state === state && [entry.slug, ...(entry.aliases ?? []).map(key)].includes(slug));
  if (builtInMatches.length === 1) return builtInMatches[0];
  const matches = seoAreas.filter((entry) => entry.state === state && [entry.slug, ...(entry.aliases ?? []).map(key)].includes(slug));
  return matches.find((entry) => entry.city === city) ?? null;
}

const changes = [];
const unknownAreas = new Map();
for (const listing of listings) {
  const location = listing.location ?? {};
  const state = stateMap.get(key(location.state)) ?? location.state;
  const city = lgaMaps.get(state)?.get(key(location.city)) ?? location.city;
  const knownArea = resolveArea(state, city, location.area, listing.area_slug ?? location.areaSlug);
  const areaName = knownArea?.canonical_name ?? titleCase(location.area);
  const areaSlug = knownArea?.slug ?? key(location.area);
  const targetCity = knownArea?.city ?? city;
  if (!knownArea && state && targetCity && areaName && areaSlug) {
    unknownAreas.set(`${state}|${targetCity}|${areaSlug}`, { state, city: targetCity, canonical_name: areaName, slug: areaSlug, aliases: [] });
  }

  const inferredSubtype = listing.property_subtype ?? inferenceRules.find(([pattern]) => pattern.test(`${listing.title} ${listing.description}`))?.[1] ?? null;
  const targetType = inferredSubtype ? subtypeGroup.get(inferredSubtype) ?? listing.property_type : ({ duplex: "house", office: "commercial", shop: "commercial" }[listing.property_type] ?? listing.property_type);
  const nextLocation = {
    ...location,
    state,
    city: targetCity,
    areaSlug,
    slug: key(`${state}-${targetCity}-${location.area}`)
  };
  const changed = state !== location.state || targetCity !== location.city || areaSlug !== (listing.area_slug ?? location.areaSlug)
    || inferredSubtype !== listing.property_subtype || targetType !== listing.property_type;
  if (changed) changes.push({ listing, nextLocation, areaSlug, propertySubtype: inferredSubtype, propertyType: targetType });
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  listingsScanned: listings.length,
  listingsToNormalize: changes.length,
  unknownAreasToRegister: unknownAreas.size,
  examples: changes.slice(0, 20).map(({ listing, nextLocation, propertyType, propertySubtype }) => ({
    id: listing.id,
    slugUnchanged: listing.slug,
    from: { state: listing.location?.state, city: listing.location?.city, areaSlug: listing.area_slug, propertyType: listing.property_type, propertySubtype: listing.property_subtype },
    to: { state: nextLocation.state, city: nextLocation.city, areaSlug: nextLocation.areaSlug, propertyType, propertySubtype }
  }))
}, null, 2));

if (!apply) {
  console.log("Dry run only. Re-run with --apply after reviewing this report and applying the latest Supabase schema.");
  process.exit(0);
}

for (const area of unknownAreas.values()) {
  const { error } = await supabase.from("seo_areas").upsert(area, { onConflict: "state,city,slug", ignoreDuplicates: true });
  if (error) throw new Error(`Area ${area.state}/${area.city}/${area.slug}: ${error.message}`);
}
for (const change of changes) {
  const { error } = await supabase.from("listings").update({
    location: change.nextLocation,
    area_slug: change.areaSlug,
    property_type: change.propertyType,
    property_subtype: change.propertySubtype
  }).eq("id", change.listing.id);
  if (error) throw new Error(`Listing ${change.listing.id}: ${error.message}`);
}
console.log(`Applied ${changes.length} listing corrections and registered ${unknownAreas.size} areas. Listing slugs were not changed.`);
