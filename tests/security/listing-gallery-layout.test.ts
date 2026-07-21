import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("listing detail gallery layout", () => {
  it("wraps thumbnails into a bounded grid instead of one horizontal row", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/listings/listing-image-gallery.tsx"), "utf8");

    expect(source).toContain("grid min-w-0 max-w-full grid-cols-3");
    expect(source).toContain("sm:grid-cols-4");
    expect(source).toContain("md:grid-cols-5");
    expect(source).toContain("xl:grid-cols-6");
    expect(source).toContain("aspect-[4/3]");
    expect(source).not.toContain("overflow-x-auto scroll-smooth");
    expect(source).not.toContain("Scroll thumbnails left");
    expect(source).not.toContain("Scroll thumbnails right");
  });

  it("contains listing detail columns and gallery width to avoid page overflow", () => {
    const detailSource = readFileSync(path.join(process.cwd(), "src/components/listings/listing-detail.tsx"), "utf8");
    const globalCss = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(detailSource).toContain("max-w-full overflow-x-hidden");
    expect(detailSource).toContain("lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]");
    expect(detailSource).toContain("min-w-0 space-y-4");
    expect(globalCss).toContain("max-width: min(100%, 48rem)");
    expect(globalCss).toContain("overflow-x: hidden");
    expect(globalCss).not.toContain("--listing-image-mobile-width");
    expect(globalCss).not.toContain("--listing-image-desktop-width");
  });
});
