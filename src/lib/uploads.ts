"use client";

import { compressImage } from "@/lib/image";
import { MAX_LISTING_IMAGES, MAX_LISTING_IMAGE_BYTES, MAX_LISTING_IMAGE_MB } from "@/lib/image-limits";
import { supabase } from "@/lib/supabase/client";

async function requireUserId() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error("You must be logged in before uploading files.");
  }

  return session.user.id;
}

async function upload(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadListingImages(files: File[]) {
  const userId = await requireUserId();
  const oversizedFile = files.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);

  if (oversizedFile) {
    throw new Error(`Each property image must be ${MAX_LISTING_IMAGE_MB} MB or less.`);
  }

  const uploads = files.slice(0, MAX_LISTING_IMAGES).map(async (file, index) => {
    const optimized = await compressImage(file);
    const path = `${userId}/${crypto.randomUUID()}-${index}.jpg`;
    await upload("listing-images", path, optimized);
    return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
  });

  return Promise.all(uploads);
}
