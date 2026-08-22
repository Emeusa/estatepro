import { NextRequest, NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/lib/auth";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { getSeoMarketCoverage } from "@/modules/seo/seo-coverage.service";
import { findCrossLgaAreaConflicts, listSeoAreas } from "@/modules/seo/seo-area.repository";
import { listSeoIndexingStatuses } from "@/modules/seo/seo-indexing.repository";

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) return limited.response;
    const [markets, indexing, areas] = await Promise.all([
      getSeoMarketCoverage(),
      listSeoIndexingStatuses(),
      listSeoAreas()
    ]);
    const areaConflicts = findCrossLgaAreaConflicts(areas);
    return withRateLimitHeaders(
      NextResponse.json({
        markets,
        indexing,
        areas,
        conflictAreaIds: areaConflicts.flatMap((conflict) => conflict.map((area) => area.id)),
        generatedAt: new Date().toISOString()
      }),
      limited.headers
    );
  } catch (error) {
    captureServerError(error, { route: "/api/admin/seo" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load SEO coverage." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
