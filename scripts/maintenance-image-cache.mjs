import { createClient } from "@supabase/supabase-js";

const BUCKET = "listing-images";
const CACHE_SECONDS = 31_536_000;
const LISTING_PAGE_SIZE = 500;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getMaxAge(cacheControl) {
  const match = cacheControl?.match(/(?:^|,)\s*max-age=(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function getContentType(path, fallback) {
  if (fallback?.startsWith("image/")) return fallback;
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function collectImageUrls(row) {
  const urls = new Set();

  if (Array.isArray(row.image_urls)) {
    for (const url of row.image_urls) {
      if (typeof url === "string") urls.add(url);
    }
  }

  if (Array.isArray(row.image_variants)) {
    for (const variant of row.image_variants) {
      if (!variant || typeof variant !== "object") continue;
      const heroUrl = variant.heroUrl ?? variant.hero_url;
      const cardUrl = variant.cardUrl ?? variant.card_url;
      if (typeof heroUrl === "string") urls.add(heroUrl);
      if (typeof cardUrl === "string") urls.add(cardUrl);
    }
  }

  return urls;
}

function getStoragePath(url, supabaseUrl) {
  try {
    const imageUrl = new URL(url);
    const projectUrl = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${BUCKET}/`;

    if (imageUrl.origin !== projectUrl.origin || !imageUrl.pathname.startsWith(prefix)) {
      return null;
    }

    return decodeURIComponent(imageUrl.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

async function listReferencedPaths(supabase, supabaseUrl) {
  const paths = new Set();

  for (let from = 0; ; from += LISTING_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("listings")
      .select("image_urls,image_variants")
      .range(from, from + LISTING_PAGE_SIZE - 1);

    if (error) throw error;

    for (const row of data ?? []) {
      for (const url of collectImageUrls(row)) {
        const path = getStoragePath(url, supabaseUrl);
        if (path) paths.add(path);
      }
    }

    if (!data || data.length < LISTING_PAGE_SIZE) break;
  }

  return [...paths].sort();
}

async function readCacheControl(publicUrl, cacheBust = false) {
  const url = cacheBust ? `${publicUrl}?cache-check=${Date.now()}` : publicUrl;
  const response = await fetch(url, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`HEAD returned ${response.status}`);
  }
  return response.headers.get("cache-control") ?? "";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const paths = await listReferencedPaths(supabase, supabaseUrl);
  const summary = { referenced: paths.length, cached: 0, pending: 0, updated: 0, failed: 0 };

  console.log(`${apply ? "Applying" : "Dry run for"} cache metadata on ${paths.length} referenced images.`);

  for (const [index, path] of paths.entries()) {
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    try {
      const currentCacheControl = await readCacheControl(publicUrl);
      if (getMaxAge(currentCacheControl) >= CACHE_SECONDS) {
        summary.cached += 1;
        continue;
      }

      summary.pending += 1;
      if (!apply) continue;

      const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
      if (downloadError || !file) throw downloadError ?? new Error("Storage download returned no file");

      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: updateError } = await supabase.storage.from(BUCKET).update(path, bytes, {
        cacheControl: String(CACHE_SECONDS),
        contentType: getContentType(path, file.type),
        upsert: true
      });
      if (updateError) throw updateError;

      const updatedCacheControl = await readCacheControl(publicUrl, true);
      if (getMaxAge(updatedCacheControl) < CACHE_SECONDS) {
        throw new Error(`Cache metadata verification failed: ${updatedCacheControl || "missing header"}`);
      }

      summary.updated += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`[${index + 1}/${paths.length}] ${path}:`, error instanceof Error ? error.message : error);
    }

    if ((index + 1) % 25 === 0 || index + 1 === paths.length) {
      console.log(`Checked ${index + 1}/${paths.length} images.`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!apply && summary.pending > 0) {
    console.log("Dry run only. Re-run with --apply to update these objects.");
  }
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
