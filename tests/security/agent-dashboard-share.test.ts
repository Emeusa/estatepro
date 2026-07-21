import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("agent dashboard share link", () => {
  it("exposes a visible share action for the public agent listings page", () => {
    const source = readFileSync(join(process.cwd(), "src/app/agents/dashboard/page.tsx"), "utf8");

    expect(source).toContain("Share my listings");
    expect(source).toContain("shareAgentListings");
    expect(source).toContain("`/agents/${data.user.id}/listings`");
    expect(source).toContain("navigator.share");
    expect(source).toContain("navigator.clipboard.writeText");
    expect(source).toContain("This page becomes public after approval and active listings.");
  });
});
