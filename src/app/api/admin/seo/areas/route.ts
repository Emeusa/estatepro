import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAdmin } from "@/lib/auth";
import { isNigeriaLga, isNigeriaState, normalizeNigeriaLga, normalizeNigeriaState } from "@/lib/nigeria-locations";
import { captureServerError } from "@/lib/security/logger";
import { RATE_LIMITS, rateLimit, withRateLimitHeaders } from "@/lib/security/rate-limit";
import { revalidateListingMutationPaths } from "@/modules/listings/listing-cache";
import { mergeSeoAreas, moveSeoArea } from "@/modules/seo/seo-area.repository";

const areaActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    areaId: z.string().uuid(),
    state: z.string().min(2).max(80),
    city: z.string().min(2).max(80)
  }).strict(),
  z.object({
    action: z.literal("merge"),
    sourceAreaId: z.string().uuid(),
    targetAreaId: z.string().uuid()
  }).strict()
]);

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    const limited = await rateLimit(request, RATE_LIMITS.admin, decoded.uid, decoded.uid);
    if (!limited.allowed) return limited.response;
    const payload = areaActionSchema.parse(await request.json());
    const result = payload.action === "move"
      ? await (async () => {
          const state = normalizeNigeriaState(payload.state);
          const city = normalizeNigeriaLga(state, payload.city);
          if (!isNigeriaState(state) || !isNigeriaLga(state, city)) {
            throw new Error("Select a valid state and LGA / Area Council.");
          }
          return moveSeoArea(payload.areaId, state, city);
        })()
      : await mergeSeoAreas(payload.sourceAreaId, payload.targetAreaId);
    revalidateListingMutationPaths();
    return withRateLimitHeaders(NextResponse.json(result), limited.headers);
  } catch (error) {
    captureServerError(error, { route: "/api/admin/seo/areas" });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not update the SEO area registry." },
      { status: error instanceof AuthError ? error.status : 400 }
    );
  }
}
