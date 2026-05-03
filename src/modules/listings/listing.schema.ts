import { z } from "zod";

import { normalizePhone, sanitizeText, slugifyLocation } from "@/lib/sanitize";

const locationSchema = z
  .object({
    state: z.string().min(2).max(80),
    city: z.string().min(2).max(80),
    area: z.string().min(2).max(80)
  })
  .transform((value) => ({
    state: sanitizeText(value.state),
    city: sanitizeText(value.city),
    area: sanitizeText(value.area),
    slug: slugifyLocation([value.state, value.city, value.area])
  }));

export const listingInputSchema = z.object({
  title: z.string().min(8).max(120).transform(sanitizeText),
  description: z.string().min(20).max(1200).transform(sanitizeText),
  price: z.number().int().positive().max(5000000000),
  propertyType: z.enum(["apartment", "duplex", "land", "office", "shop"]),
  imageUrls: z.array(z.string().url()).min(1).max(12),
  contactPhone: z.string().min(10).max(20).transform(normalizePhone),
  contactWhatsapp: z.string().min(10).max(20).transform(normalizePhone),
  location: locationSchema
});

export const listingFilterSchema = z.object({
  location: z.string().optional(),
  propertyType: z.enum(["apartment", "duplex", "land", "office", "shop"]).optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(12)
});
