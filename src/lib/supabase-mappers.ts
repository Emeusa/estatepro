import { toNameCase, toTitleCase } from "@/lib/format";
import { normalizeBusinessName } from "@/lib/agent-display";
import {
  AgentProfile,
  ListingImageVariant,
  ListingRecord,
  LocationValue,
  SubscriptionAdminGrantRecord,
  SubscriptionRecord,
  UserRecord
} from "@/lib/types";

type DatabaseUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: "agent" | "client" | "admin";
  created_at: string;
};

type DatabaseAgent = {
  id: string;
  verification_status: AgentProfile["verificationStatus"];
  business_name?: string | null;
  nin_number: string | null;
  cac_number?: string | null;
  is_blocked: boolean;
  trial_ends_at: string;
};

type DatabaseSubscription = {
  agent_id: string;
  plan_slug?: string | null;
  payment_provider?: SubscriptionRecord["paymentProvider"] | null;
  billing_mode?: SubscriptionRecord["billingMode"] | null;
  paystack_customer_code?: string | null;
  paystack_subscription_code?: string | null;
  paystack_email_token?: string | null;
  paystack_plan_code?: string | null;
  opay_order_no?: string | null;
  opay_transaction_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  status?: SubscriptionRecord["status"] | null;
  trial_starts_at: string;
  trial_ends_at: string;
  is_active: boolean;
};

type DatabaseSubscriptionAdminGrant = {
  id: string;
  agent_id: string;
  admin_id?: string | null;
  plan_slug: string;
  period_start: string;
  period_end?: string | null;
  reason: string;
  previous_plan_slug?: string | null;
  previous_status?: string | null;
  previous_period_end?: string | null;
  created_at: string;
};

type DatabaseListing = {
  id: string;
  slug?: string | null;
  agent_id: string;
  title: string;
  description: string;
  price: number;
  property_type: ListingRecord["propertyType"];
  listing_category?: ListingRecord["listingCategory"];
  availability?: ListingRecord["availability"];
  status: ListingRecord["status"];
  image_urls: string[];
  image_variants?: unknown;
  promotion_type?: ListingRecord["promotionType"] | null;
  boosted_at?: string | null;
  last_refreshed_at?: string | null;
  expires_at?: string | null;
  featured_until?: string | null;
  sponsored_until?: string | null;
  photos_verified_at?: string | null;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  retention_until?: string | null;
  media_delete_after?: string | null;
  hard_delete_after?: string | null;
  media_deleted_at?: string | null;
  legal_hold_until?: string | null;
  agent_keep_active_priority?: number | null;
  contact_phone: string;
  contact_whatsapp: string;
  location: LocationValue;
  bedrooms?: number | null;
  bathrooms?: number | null;
  toilets?: number | null;
  parking_spaces?: number | null;
  property_size?: number | null;
  property_size_unit?: ListingRecord["propertySizeUnit"] | null;
  year_built?: number | null;
  floor_level?: number | null;
  total_floors?: number | null;
  furnishing_status?: ListingRecord["furnishingStatus"] | null;
  servicing_status?: ListingRecord["servicingStatus"] | null;
  property_condition?: ListingRecord["propertyCondition"] | null;
  amenities?: unknown;
  utilities?: unknown;
  safety_features?: unknown;
  nearby_landmarks?: unknown;
  extra_features?: unknown;
  land_size?: number | null;
  land_size_unit?: ListingRecord["landSizeUnit"] | null;
  title_document_type?: ListingRecord["titleDocumentType"] | null;
  zoning_type?: ListingRecord["zoningType"] | null;
  road_access?: ListingRecord["roadAccess"] | null;
  created_at: string;
  updated_at: string;
};

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toListingImageVariants(value: unknown): ListingImageVariant[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index): ListingImageVariant | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const image = item as Record<string, unknown>;
      if (typeof image.heroUrl !== "string" || typeof image.cardUrl !== "string") {
        return null;
      }

      return {
        heroUrl: image.heroUrl,
        cardUrl: image.cardUrl,
        blurDataUrl: typeof image.blurDataUrl === "string" ? image.blurDataUrl : null,
        width: toNullableNumber(image.width),
        height: toNullableNumber(image.height),
        cardWidth: toNullableNumber(image.cardWidth),
        cardHeight: toNullableNumber(image.cardHeight),
        order: typeof image.order === "number" && Number.isInteger(image.order) ? image.order : index
      };
    })
    .filter((image): image is ListingImageVariant => Boolean(image))
    .sort((first, second) => first.order - second.order);
}

export function toUserRecord(row: DatabaseUser): UserRecord {
  return {
    id: row.id,
    email: row.email,
    fullName: toNameCase(row.full_name),
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at
  };
}

export function toAgentProfile(row: DatabaseAgent): AgentProfile {
  return {
    id: row.id,
    verificationStatus: row.verification_status,
    businessName: normalizeBusinessName(row.business_name),
    ninNumber: row.nin_number ?? null,
    cacNumber: row.cac_number ?? null,
    isBlocked: row.is_blocked,
    trialEndsAt: row.trial_ends_at
  };
}

export function toSubscriptionRecord(row: DatabaseSubscription): SubscriptionRecord {
  return {
    agentId: row.agent_id,
    planSlug: row.plan_slug ?? "free_starter",
    paymentProvider: row.payment_provider ?? "paystack",
    billingMode: row.billing_mode ?? "recurring",
    trialStartsAt: row.trial_starts_at,
    trialEndsAt: row.trial_ends_at,
    isActive: row.is_active,
    status: row.status ?? (row.is_active ? "active" : "inactive"),
    paystackCustomerCode: row.paystack_customer_code ?? null,
    paystackSubscriptionCode: row.paystack_subscription_code ?? null,
    paystackEmailToken: row.paystack_email_token ?? null,
    paystackPlanCode: row.paystack_plan_code ?? null,
    opayOrderNo: row.opay_order_no ?? null,
    opayTransactionId: row.opay_transaction_id ?? null,
    currentPeriodStart: row.current_period_start ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    cancelAtPeriodEnd: row.cancel_at_period_end ?? false
  };
}

export function toSubscriptionAdminGrantRecord(
  row: DatabaseSubscriptionAdminGrant
): SubscriptionAdminGrantRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    adminId: row.admin_id ?? null,
    planSlug: row.plan_slug,
    periodStart: row.period_start,
    periodEnd: row.period_end ?? null,
    reason: row.reason,
    previousPlanSlug: row.previous_plan_slug ?? null,
    previousStatus: row.previous_status ?? null,
    previousPeriodEnd: row.previous_period_end ?? null,
    createdAt: row.created_at
  };
}

export function toListingRecord(row: DatabaseListing): ListingRecord {
  return {
    id: row.id,
    slug: row.slug ?? row.id,
    agentId: row.agent_id,
    title: toTitleCase(row.title),
    description: row.description,
    price: row.price,
    propertyType: row.property_type,
    listingCategory: row.listing_category ?? "for_sale",
    availability: row.availability ?? "available",
    status: row.status,
    imageUrls: row.image_urls ?? [],
    imageVariants: toListingImageVariants(row.image_variants),
    promotionType: row.promotion_type ?? "standard",
    boostedAt: row.boosted_at ?? null,
    lastRefreshedAt: row.last_refreshed_at ?? null,
    expiresAt: row.expires_at ?? null,
    featuredUntil: row.featured_until ?? null,
    sponsoredUntil: row.sponsored_until ?? null,
    photosVerifiedAt: row.photos_verified_at ?? null,
    deactivatedAt: row.deactivated_at ?? null,
    deactivationReason: row.deactivation_reason ?? null,
    retentionUntil: row.retention_until ?? null,
    mediaDeleteAfter: row.media_delete_after ?? null,
    hardDeleteAfter: row.hard_delete_after ?? null,
    mediaDeletedAt: row.media_deleted_at ?? null,
    legalHoldUntil: row.legal_hold_until ?? null,
    agentKeepActivePriority: row.agent_keep_active_priority ?? null,
    contactPhone: row.contact_phone,
    contactWhatsapp: row.contact_whatsapp,
    location: row.location,
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    toilets: row.toilets ?? null,
    parkingSpaces: row.parking_spaces ?? null,
    propertySize: row.property_size ?? null,
    propertySizeUnit: row.property_size_unit ?? null,
    yearBuilt: row.year_built ?? null,
    floorLevel: row.floor_level ?? null,
    totalFloors: row.total_floors ?? null,
    furnishingStatus: row.furnishing_status ?? null,
    servicingStatus: row.servicing_status ?? null,
    propertyCondition: row.property_condition ?? null,
    amenities: toStringArray(row.amenities),
    utilities: toStringArray(row.utilities),
    safetyFeatures: toStringArray(row.safety_features),
    nearbyLandmarks: toStringArray(row.nearby_landmarks),
    extraFeatures: toStringArray(row.extra_features),
    landSize: row.land_size ?? null,
    landSizeUnit: row.land_size_unit ?? null,
    titleDocumentType: row.title_document_type ?? null,
    zoningType: row.zoning_type ?? null,
    roadAccess: row.road_access ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
