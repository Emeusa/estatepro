import { z } from "zod";

export const savedListingMutationSchema = z
  .object({
    listingId: z.string().uuid()
  })
  .strict();

export function parseSavedListingIdsParam(value: string | null) {
  if (!value?.trim()) {
    return [];
  }

  return z
    .array(z.string().uuid())
    .max(100)
    .parse(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );
}
