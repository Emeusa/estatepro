/** @type {import('next').NextConfig} */
function getSupabaseImageHost() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return null;
  }

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return null;
  }
}

const supabaseImageHost = getSupabaseImageHost();

const nextConfig = {
  images: {
    deviceSizes: [320, 480, 640, 750, 828, 1080, 1200],
    imageSizes: [64, 96, 128, 256, 384],
    remotePatterns: supabaseImageHost
      ? [
          {
            protocol: "https",
            hostname: supabaseImageHost,
            pathname: "/storage/v1/object/public/listing-images/**"
          }
        ]
      : []
  }
};

export default nextConfig;
