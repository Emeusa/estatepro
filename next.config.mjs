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

function getSecurityHeaders() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const connectSources = ["'self'", supabaseUrl, "https://challenges.cloudflare.com"].filter(Boolean).join(" ");
  const imageSources = ["'self'", "data:", "blob:", supabaseUrl].filter(Boolean).join(" ");
  const scriptSources =
    process.env.NODE_ENV === "development"
      ? "'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
      : "'self' 'unsafe-inline' https://challenges.cloudflare.com";

  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources}`,
    `connect-src ${connectSources}`,
    "font-src 'self' data:",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" }
  ];
}

const nextConfig = {
  poweredByHeader: false,
  images: {
    deviceSizes: [320, 480, 640, 750, 828, 1080, 1200],
    imageSizes: [64, 96, 128, 256, 384],
    qualities: [70, 78],
    remotePatterns: supabaseImageHost
      ? [
          {
            protocol: "https",
            hostname: supabaseImageHost,
            pathname: "/storage/v1/object/public/listing-images/**"
          }
        ]
      : []
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: getSecurityHeaders()
      }
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.c59estatehub.com" }],
        destination: "https://c59estatehub.com/:path*",
        permanent: true
      }
    ];
  },
  webpack(config) {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /libheif-js[\\/]libheif-wasm[\\/]libheif-bundle\.js/,
        message: /Critical dependency: require function is used in a way/
      }
    ];

    return config;
  }
};

export default nextConfig;
