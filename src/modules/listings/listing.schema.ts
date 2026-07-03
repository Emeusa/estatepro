import { z } from "zod";

import { normalizeListingTitle } from "@/lib/format";
import { MAX_LISTING_IMAGES } from "@/lib/image-limits";
import {
  FURNISHING_STATUSES,
  LAND_SIZE_UNITS,
  PROPERTY_CONDITIONS,
  PROPERTY_SIZE_UNITS,
  ROAD_ACCESS_TYPES,
  SERVICING_STATUSES,
  TITLE_DOCUMENT_TYPES,
  ZONING_TYPES
} from "@/lib/listing-quality";
import { isNigeriaLga, isNigeriaState } from "@/lib/nigeria-locations";
import { normalizePhone, sanitizeText, slugifyLocation } from "@/lib/sanitize";

function isAllowedListingImageUrl(value: string, options?: { webpOnly?: boolean }) {
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
      imageUrl.pathname.startsWith("/storage/v1/object/public/listing-images/") &&
      (!options?.webpOnly || imageUrl.pathname.toLowerCase().endsWith(".webp"))
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

function emptyToNull(value: unknown) {
  return value === "" || value === null || value === undefined ? null : value;
}

function optionalPositiveInt(max: number) {
  return z
    .preprocess(emptyToNull, z.coerce.number().int().positive().max(max).nullable().optional())
    .transform((value) => value ?? null);
}

function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(emptyToNull, z.enum(values).nullable().optional()).transform((value) => value ?? null);
}

function parseTextArray(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value.split(/[\n,]/g);
  }

  return value;
}

const textArraySchema = z
  .preprocess(
    parseTextArray,
    z
      .array(z.string().trim().min(2).max(80).transform(sanitizeText))
      .max(30)
  )
  .transform((values) => Array.from(new Set(values.filter(Boolean))));

const imageVariantSchema = z
  .object({
    heroUrl: z.string().url().refine((value) => isAllowedListingImageUrl(value, { webpOnly: true }), {
      message: "Hero images must be uploaded through this platform."
    }),
    cardUrl: z.string().url().refine((value) => isAllowedListingImageUrl(value, { webpOnly: true }), {
      message: "Card images must be uploaded through this platform."
    }),
    blurDataUrl: z
      .string()
      .max(3000)
      .regex(/^data:image\/webp;base64,[a-z0-9+/=]+$/i)
      .nullable(),
    width: z.number().int().positive().max(1200).nullable(),
    height: z.number().int().positive().max(900).nullable(),
    cardWidth: z.number().int().positive().max(600).nullable(),
    cardHeight: z.number().int().positive().max(450).nullable(),
    order: z.number().int().min(0).max(MAX_LISTING_IMAGES - 1)
  })
  .strict();

const listingInputBaseSchema = z.object({
  title: z.string().min(8).max(120).transform((value) => normalizeListingTitle(sanitizeText(value))),
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
    .max(MAX_LISTING_IMAGES),
  imageVariants: z.array(imageVariantSchema).max(MAX_LISTING_IMAGES).default([]),
  contactPhone: z.string().min(10).max(20).transform(normalizePhone),
  contactWhatsapp: z.string().min(10).max(20).transform(normalizePhone),
  location: locationSchema,
  bedrooms: optionalPositiveInt(100),
  bathrooms: optionalPositiveInt(100),
  toilets: optionalPositiveInt(100),
  parkingSpaces: optionalPositiveInt(100),
  propertySize: optionalPositiveInt(10000000),
  propertySizeUnit: optionalEnum(PROPERTY_SIZE_UNITS),
  yearBuilt: optionalPositiveInt(new Date().getFullYear() + 1),
  floorLevel: optionalPositiveInt(300),
  totalFloors: optionalPositiveInt(300),
  furnishingStatus: optionalEnum(FURNISHING_STATUSES),
  servicingStatus: optionalEnum(SERVICING_STATUSES),
  propertyCondition: optionalEnum(PROPERTY_CONDITIONS),
  amenities: textArraySchema.default([]),
  utilities: textArraySchema.default([]),
  safetyFeatures: textArraySchema.default([]),
  nearbyLandmarks: textArraySchema.default([]),
  extraFeatures: textArraySchema.default([]),
  landSize: optionalPositiveInt(10000000),
  landSizeUnit: optionalEnum(LAND_SIZE_UNITS),
  titleDocumentType: optionalEnum(TITLE_DOCUMENT_TYPES),
  zoningType: optionalEnum(ZONING_TYPES),
  roadAccess: optionalEnum(ROAD_ACCESS_TYPES)
}).strict();

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
  keyword: z.string().trim().max(120).optional(),
  location: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  propertyType: z.enum(["apartment", "duplex", "land", "office", "shop"]).optional(),
  listingCategory: z.enum(["for_sale", "for_rent", "short_let"]).optional(),
  minPrice: z.coerce.number().int().positive().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  bedrooms: z.coerce.number().int().positive().max(100).optional(),
  bathrooms: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(12)
}).strict().superRefine((value, context) => {
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
}).strict();
