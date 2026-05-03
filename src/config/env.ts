const requiredClientKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
] as const;

type ClientKey = (typeof requiredClientKeys)[number];

function readEnv(key: string, allowEmpty = false) {
  const value = process.env[key];
  if (!allowEmpty && !value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value ?? "";
}

export function getClientEnv() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };

  for (const key of requiredClientKeys) {
    if (!env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  return env as Record<ClientKey, string>;
}

export function getServerEnv() {
  return {
    serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    dbPassword: readEnv("SUPABASE_DB_PASSWORD", true),
    projectId: readEnv("SUPABASE_PROJECT_ID", true)
  };
}
