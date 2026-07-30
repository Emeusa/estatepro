import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readSchema() {
  return readFileSync(path.join(process.cwd(), "docs/supabase-schema.sql"), "utf8");
}

function normalizeSql(sql: string) {
  return sql.toLowerCase().replace(/\s+/g, " ").trim();
}

describe("Supabase schema security", () => {
  it("uses security-invoker public listing views", () => {
    const schema = normalizeSql(readSchema());

    expect(schema).toContain(
      "create or replace view public.public_listings with (security_invoker = true) as"
    );
    expect(schema).toContain(
      "create or replace view public.public_feed_listings with (security_invoker = true) as"
    );
  });

  it("keeps public listing views server-mediated through service role grants", () => {
    const schema = normalizeSql(readSchema());

    expect(schema).toContain("revoke all on table public.public_listings from anon, authenticated;");
    expect(schema).toContain("revoke all on table public.public_feed_listings from anon, authenticated;");
    expect(schema).toContain(
      "grant select on table public.public_listings, public.public_feed_listings to service_role;"
    );
  });

  it("keeps approved and unblocked agent filters on public listing views", () => {
    const schema = normalizeSql(readSchema());

    expect(schema).toContain("agents.verification_status = 'approved'");
    expect(schema).toContain("agents.is_blocked = false");
    expect(schema).toContain("listings.status = 'active'");
    expect(schema).toContain("listings.availability = 'available'");
  });
});
