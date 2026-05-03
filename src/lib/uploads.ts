"use client";

import { compressImage } from "@/lib/image";
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
    upsert: true
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadListingImages(files: File[]) {
  const userId = await requireUserId();

  const uploads = files.slice(0, 12).map(async (file, index) => {
    const optimized = await compressImage(file);
    const path = `${userId}/${Date.now()}-${index}.jpg`;
    await upload("listing-images", path, optimized);
    return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
  });

  return Promise.all(uploads);
}

export async function uploadVerificationDocuments(files: File[]) {
  const userId = await requireUserId();

  const uploads = files.slice(0, 4).map(async (file, index) => {
    const path = `${userId}/${Date.now()}-${index}-${file.name}`;
    await upload("verification-documents", path, file);
    return path;
  });

  return Promise.all(uploads);
}
