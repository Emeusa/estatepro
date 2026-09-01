import { createServerSupabaseClient } from "@/lib/supabase/server";

const LISTING_IMAGE_BUCKET = "listing-images";
const LISTING_PAGE_SIZE = 500;
const STORAGE_PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 100;
const DEFAULT_MINIMUM_AGE_HOURS = 72;
const DEFAULT_MAX_DELETES = 250;

type StorageObject = {
  path: string;
  createdAt: string | null;
};

export type ListingImageCleanupResult = {
  dryRun: boolean;
  scannedObjects: number;
  referencedObjects: number;
  eligibleOrphans: number;
  deletedObjects: number;
  failedObjects: number;
  protectedRecentObjects: number;
  deletionLimit: number;
};

function collectImageUrls(row: { image_urls?: unknown; image_variants?: unknown }) {
  const urls = new Set<string>();
  if (Array.isArray(row.image_urls)) {
    for (const value of row.image_urls) {
      if (typeof value === "string") urls.add(value);
    }
  }

  if (Array.isArray(row.image_variants)) {
    for (const value of row.image_variants) {
      if (!value || typeof value !== "object") continue;
      const variant = value as Record<string, unknown>;
      const heroUrl = variant.heroUrl ?? variant.hero_url;
      const cardUrl = variant.cardUrl ?? variant.card_url;
      if (typeof heroUrl === "string") urls.add(heroUrl);
      if (typeof cardUrl === "string") urls.add(cardUrl);
    }
  }

  return urls;
}

function getListingImageStoragePath(url: string, supabaseUrl: string) {
  try {
    const imageUrl = new URL(url);
    const projectUrl = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${LISTING_IMAGE_BUCKET}/`;
    if (imageUrl.origin !== projectUrl.origin || !imageUrl.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(imageUrl.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

function isSafeListingImagePath(path: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[a-z0-9][a-z0-9._-]*$/i.test(path);
}

export function selectEligibleListingImageOrphans(input: {
  objects: StorageObject[];
  referencedPaths: Set<string>;
  minimumAgeHours?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const minimumAgeMs = (input.minimumAgeHours ?? DEFAULT_MINIMUM_AGE_HOURS) * 60 * 60 * 1000;
  let protectedRecentObjects = 0;
  const eligible = input.objects.filter((object) => {
    if (input.referencedPaths.has(object.path) || !isSafeListingImagePath(object.path)) return false;
    const createdAt = object.createdAt ? new Date(object.createdAt).getTime() : Number.NaN;
    if (!Number.isFinite(createdAt) || now.getTime() - createdAt < minimumAgeMs) {
      protectedRecentObjects += 1;
      return false;
    }
    return true;
  });

  return { eligible, protectedRecentObjects };
}

async function listReferencedImagePaths(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  supabaseUrl: string
) {
  const paths = new Set<string>();
  for (let from = 0; ; from += LISTING_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("listings")
      .select("image_urls,image_variants")
      .range(from, from + LISTING_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      for (const url of collectImageUrls(row)) {
        const path = getListingImageStoragePath(url, supabaseUrl);
        if (path) paths.add(path);
      }
    }

    if (!data || data.length < LISTING_PAGE_SIZE) break;
  }
  return paths;
}

async function listStorageObjects(supabase: ReturnType<typeof createServerSupabaseClient>) {
  const bucket = supabase.storage.from(LISTING_IMAGE_BUCKET);
  const objects: StorageObject[] = [];

  async function visit(prefix: string) {
    for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
      const { data, error } = await bucket.list(prefix, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" }
      });
      if (error) throw new Error(error.message);

      for (const entry of data ?? []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) {
          objects.push({ path, createdAt: entry.created_at ?? entry.updated_at ?? null });
        } else {
          await visit(path);
        }
      }

      if (!data || data.length < STORAGE_PAGE_SIZE) break;
    }
  }

  await visit("");
  return objects;
}

export async function reconcileListingImageOrphans(options?: {
  dryRun?: boolean;
  minimumAgeHours?: number;
  maxDeletes?: number;
}): Promise<ListingImageCleanupResult> {
  const dryRun = options?.dryRun ?? true;
  const deletionLimit = Math.max(0, Math.min(options?.maxDeletes ?? DEFAULT_MAX_DELETES, 1000));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for image cleanup.");

  const supabase = createServerSupabaseClient();
  const [referencedPaths, objects] = await Promise.all([
    listReferencedImagePaths(supabase, supabaseUrl),
    listStorageObjects(supabase)
  ]);
  const { eligible, protectedRecentObjects } = selectEligibleListingImageOrphans({
    objects,
    referencedPaths,
    minimumAgeHours: options?.minimumAgeHours
  });
  const selected = eligible.slice(0, deletionLimit);
  let deletedObjects = 0;
  let failedObjects = 0;

  if (!dryRun) {
    for (let index = 0; index < selected.length; index += DELETE_BATCH_SIZE) {
      const batch = selected.slice(index, index + DELETE_BATCH_SIZE).map((object) => object.path);
      const { error } = await supabase.storage.from(LISTING_IMAGE_BUCKET).remove(batch);
      if (error) {
        failedObjects += batch.length;
      } else {
        deletedObjects += batch.length;
      }
    }
  }

  return {
    dryRun,
    scannedObjects: objects.length,
    referencedObjects: referencedPaths.size,
    eligibleOrphans: eligible.length,
    deletedObjects,
    failedObjects,
    protectedRecentObjects,
    deletionLimit
  };
}
