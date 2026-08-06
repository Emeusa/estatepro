export function shouldOptimizeListingImage(url: string) {
  if (process.env.NEXT_PUBLIC_LISTING_IMAGE_DELIVERY_MODE !== "vercel") {
    return false;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return false;
  }

  try {
    const imageUrl = new URL(url);
    const configuredUrl = new URL(supabaseUrl);

    return (
      imageUrl.protocol === "https:" &&
      imageUrl.hostname === configuredUrl.hostname &&
      imageUrl.pathname.startsWith("/storage/v1/object/public/listing-images/")
    );
  } catch {
    return false;
  }
}
