import { z } from "zod";

import { toTitleCase } from "@/lib/format";
import { isNigeriaLga, isNigeriaState } from "@/lib/nigeria-locations";
import { normalizePhone, sanitizeText, slugifyLocation } from "@/lib/sanitize";

function isAllowedListingImageUrl(value: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return false;
  }

  try {
    const configuredHost = new URL(supabaseUrl).hostname;
    const imageUrl = new URL(value);
    return (
      imageUrl.protocol === "https:" &&
      imageUrl.hostname === configuredHost &&
      imageUrl.pathname.startsWith("/storage/v1/object/public/listing-images/")
    );
  } catch {
    return false;
  }
}

const locationSchema = z
  .object({
    state: z.string().min(2).max(80),
    city: z.string().min(2).max(80),
    area: z.string().min(2).max(80)
  })
  .superRefine((value, context) => {
    if (!isNigeriaState(value.state)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a valid Nigerian state.",
        path: ["state"]
      });
      return;
    }

    if (!isNigeriaLga(value.state, value.city)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a valid LGA for this state.",
        path: ["city"]
      });
    }
  })
  .transform((value) => ({
    state: sanitizeText(value.state),
    city: sanitizeText(value.city),
    area: sanitizeText(value.area),
    slug: slugifyLocation([value.state, value.city, value.area])
  }));

const listingInputBaseSchema = z.object({
  title: z.string().min(8).max(120).transform((value) => toTitleCase(sanitizeText(value))),
  description: z.string().min(20).max(1200).transform(sanitizeText),
  price: z.number().int().positive().max(5000000000),
  propertyType: z.enum(["apartment", "duplex", "land", "office", "shop"]),
  listingCategory: z.enum(["for_sale", "for_rent", "short_let"]).default("for_sale"),
  availability: z.enum(["available", "sold", "rented", "booked"]).default("available"),
  imageUrls: z
    .array(
      z.string().url().refine(isAllowedListingImageUrl, {
        message: "Listing images must be uploaded through this platform."
      })
    )
    .min(1)
    .max(12),
  contactPhone: z.string().min(10).max(20).transform(normalizePhone),
  contactWhatsapp: z.string().min(10).max(20).transform(normalizePhone),
  location: locationSchema
});

function validateAvailability(
  value: { listingCategory?: "for_sale" | "for_rent" | "short_let"; availability?: "available" | "sold" | "rented" | "booked" },
  context: z.RefinementCtx
) {
  if (!value.listingCategory || !value.availability) {
    return;
  }

  const allowedAvailability = {
    for_sale: ["available", "sold"],
    for_rent: ["available", "rented"],
    short_let: ["available", "booked"]
  }[value.listingCategory];

  if (!allowedAvailability.includes(value.availability)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a valid availability for this listing category.",
      path: ["availability"]
    });
  }
}

export const listingInputSchema = listingInputBaseSchema.superRefine(validateAvailability);

export const listingUpdateSchema = listingInputBaseSchema.partial().superRefine(validateAvailability);

export const listingFilterSchema = z.object({
  location: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  propertyType: z.enum(["apartment", "duplex", "land", "office", "shop"]).optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(12)
}).superRefine((value, context) => {
  if (value.state && !isNigeriaState(value.state)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a valid Nigerian state.",
      path: ["state"]
    });
  }

  if (value.city && (!value.state || !isNigeriaLga(value.state, value.city))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a valid LGA for this state.",
      path: ["city"]
    });
  }
});

export const listingModerationSchema = z.object({
  status: z.enum(["pending", "active", "blocked"])
});
