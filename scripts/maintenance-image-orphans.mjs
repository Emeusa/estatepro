import { createClient } from "@supabase/supabase-js";

const BUCKET = "listing-images";
const LISTING_PAGE_SIZE = 500;
const STORAGE_PAGE_SIZE = 1000;
const MINIMUM_AGE_MS = 72 * 60 * 60 * 1000;
const MAX_DELETES = 250;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function collectUrls(row) {
  const urls = new Set(Array.isArray(row.image_urls) ? row.image_urls.filter((value) => typeof value === "string") : []);
  for (const variant of Array.isArray(row.image_variants) ? row.image_variants : []) {
    if (!variant || typeof variant !== "object") continue;
    for (const value of [variant.heroUrl ?? variant.hero_url, variant.cardUrl ?? variant.card_url]) {
      if (typeof value === "string") urls.add(value);
    }
  }
  return urls;
}

function storagePath(url, supabaseUrl) {
  try {
    const parsed = new URL(url);
    const project = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    if (parsed.origin !== project.origin || !parsed.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

function safePath(path) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[a-z0-9][a-z0-9._-]*$/i.test(path);
}

async function referencedPaths(supabase, supabaseUrl) {
  const paths = new Set();
  for (let from = 0; ; from += LISTING_PAGE_SIZE) {
    const { data, error } = await supabase.from("listings").select("image_urls,image_variants").range(from, from + LISTING_PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      for (const url of collectUrls(row)) {
        const path = storagePath(url, supabaseUrl);
        if (path) paths.add(path);
      }
    }
    if (!data || data.length < LISTING_PAGE_SIZE) break;
  }
  return paths;
}

async function storageObjects(supabase) {
  const bucket = supabase.storage.from(BUCKET);
  const objects = [];
  async function visit(prefix) {
    for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
      const { data, error } = await bucket.list(prefix, { limit: STORAGE_PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) objects.push({ path, createdAt: entry.created_at ?? entry.updated_at ?? null });
        else await visit(path);
      }
      if (!data || data.length < STORAGE_PAGE_SIZE) break;
    }
  }
  await visit("");
  return objects;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const summaryOnly = process.argv.includes("--summary-only");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabase = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const [references, objects] = await Promise.all([referencedPaths(supabase, supabaseUrl), storageObjects(supabase)]);
  const eligible = objects.filter((object) => {
    if (references.has(object.path) || !safePath(object.path) || !object.createdAt) return false;
    return Date.now() - new Date(object.createdAt).getTime() >= MINIMUM_AGE_MS;
  });
  const selected = eligible.slice(0, MAX_DELETES);
  const summary = {
    dryRun: !apply,
    scannedObjects: objects.length,
    referencedObjects: references.size,
    eligibleOrphans: eligible.length,
    selectedObjects: selected.length,
    deletedObjects: 0,
    failedObjects: 0
  };

  console.log(`${apply ? "Applying" : "Dry run for"} orphan image cleanup with a 72-hour safety window.`);
  if (!summaryOnly) {
    for (const object of selected) console.log(`${apply ? "delete" : "candidate"}: ${object.path}`);
  }

  if (apply) {
    for (let index = 0; index < selected.length; index += 100) {
      const batch = selected.slice(index, index + 100).map((object) => object.path);
      const { error } = await supabase.storage.from(BUCKET).remove(batch);
      if (error) {
        summary.failedObjects += batch.length;
        console.error(`Delete batch failed: ${error.message}`);
      } else {
        summary.deletedObjects += batch.length;
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!apply && eligible.length) console.log("Dry run only. Review candidates, then re-run with --apply.");
  if (summary.failedObjects) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
