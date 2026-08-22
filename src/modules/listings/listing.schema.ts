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
import {
  isNigeriaLga,
  isNigeriaState,
  normalizeNigeriaLga,
  normalizeNigeriaState
} from "@/lib/nigeria-locations";
import {
  isSubtypeForPropertyType,
  normalizePropertyType,
  PROPERTY_SUBTYPE_LABELS
} from "@/lib/property-taxonomy";
import { normalizePhone, sanitizeText, slugifyLocation } from "@/lib/sanitize";

const propertyTypeInputSchema = z
  .enum(["apartment", "house", "room", "land", "commercial", "duplex", "office", "shop"])
  .transform(normalizePropertyType);

const propertySubtypeSchema = z.enum(
  Object.keys(PROPERTY_SUBTYPE_LABELS) as [
    keyof typeof PROPERTY_SUBTYPE_LABELS,
    ...(keyof typeof PROPERTY_SUBTYPE_LABELS)[]
  ]
);

function isAllowedListingImageUrl(value: string, options?: { optimizedVariantOnly?: boolean }) {
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
      (!options?.optimizedVariantOnly || /\.(webp|jpe?g)$/i.test(imageUrl.pathname))
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
    state: normalizeNigeriaState(sanitizeText(value.state)),
    city: normalizeNigeriaLga(value.state, sanitizeText(value.city)),
    area: sanitizeText(value.area),
    areaSlug: slugifyLocation([value.area]),
    slug: slugifyLocation([normalizeNigeriaState(value.state), value.city, value.area])
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

function nullableImageDimension(max: number) {
  return z.preprocess((value) => {
    const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(numberValue)) {
      return null;
    }

    const rounded = Math.round(numberValue);
    return rounded > 0 && rounded <= max ? rounded : null;
  }, z.number().int().positive().max(max).nullable());
}

function nullableBlurDataUrl() {
  const blurPattern = /^data:image\/(webp|jpeg);base64,[a-z0-9+/=]+$/i;
  return z.preprocess((value) => {
    if (typeof value !== "string" || value.length > 3000 || !blurPattern.test(value)) {
      return null;
    }

    return value;
  }, z.string().max(3000).regex(blurPattern).nullable());
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
    heroUrl: z.string().url().refine((value) => isAllowedListingImageUrl(value, { optimizedVariantOnly: true }), {
      message: "Hero images must be uploaded through this platform."
    }),
    cardUrl: z.string().url().refine((value) => isAllowedListingImageUrl(value, { optimizedVariantOnly: true }), {
      message: "Card images must be uploaded through this platform."
    }),
    blurDataUrl: nullableBlurDataUrl(),
    width: nullableImageDimension(1200),
    height: nullableImageDimension(900),
    cardWidth: nullableImageDimension(600),
    cardHeight: nullableImageDimension(450),
    order: z.number().int().min(0).max(MAX_LISTING_IMAGES - 1)
  })
  .strict();

const listingInputBaseSchema = z.object({
  title: z.string().min(8).max(120).transform((value) => normalizeListingTitle(sanitizeText(value))),
  description: z.string().min(20).max(1200).transform(sanitizeText),
  price: z.number().int().positive().max(5000000000),
  propertyType: propertyTypeInputSchema,
  propertySubtype: z.preprocess(emptyToNull, propertySubtypeSchema.nullable().optional()).transform((value) => value ?? null),
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

function validatePropertyTaxonomy(
  value: { propertyType?: "apartment" | "house" | "room" | "land" | "commercial"; propertySubtype?: keyof typeof PROPERTY_SUBTYPE_LABELS | null },
  context: z.RefinementCtx
) {
  if (value.propertyType && value.propertySubtype && !isSubtypeForPropertyType(value.propertyType, value.propertySubtype)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a property subtype that matches the property group.",
      path: ["propertySubtype"]
    });
  }
}

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

export const listingInputSchema = listingInputBaseSchema.superRefine((value, context) => {
  validateAvailability(value, context);
  validatePropertyTaxonomy(value, context);
});

export const listingUpdateSchema = listingInputBaseSchema.partial().superRefine((value, context) => {
  validateAvailability(value, context);
  validatePropertyTaxonomy(value, context);
});

export const listingFilterSchema = z.object({
  keyword: z.string().trim().max(120).optional(),
  location: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  propertyType: propertyTypeInputSchema.optional(),
  propertySubtype: propertySubtypeSchema.optional(),
  areaSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).optional(),
  listingCategory: z.enum(["for_sale", "for_rent", "short_let"]).optional(),
  minPrice: z.coerce.number().int().positive().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  bedrooms: z.coerce.number().int().positive().max(100).optional(),
  bathrooms: z.coerce.number().int().positive().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10).default(10)
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
  status: z.enum(["pending", "active", "inactive", "blocked"]).optional(),
  legalHoldUntil: z.string().datetime().nullable().optional()
}).strict().refine((value) => value.status !== undefined || value.legalHoldUntil !== undefined, {
  message: "Provide a listing status or legal hold update."
});

export const listingRetentionActionSchema = z.object({
  action: z.enum(["keep_active", "clear_keep_active", "reactivate"])
}).strict();
