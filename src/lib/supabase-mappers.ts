import { toNameCase, toTitleCase } from "@/lib/format";
import {
  AgentProfile,
  ListingRecord,
  LocationValue,
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
  nin_number: string | null;
  is_blocked: boolean;
  trial_ends_at: string;
};

type DatabaseSubscription = {
  agent_id: string;
  trial_starts_at: string;
  trial_ends_at: string;
  is_active: boolean;
};

type DatabaseListing = {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  price: number;
  property_type: ListingRecord["propertyType"];
  listing_category?: ListingRecord["listingCategory"];
  availability?: ListingRecord["availability"];
  status: ListingRecord["status"];
  image_urls: string[];
  contact_phone: string;
  contact_whatsapp: string;
  location: LocationValue;
  created_at: string;
  updated_at: string;
};

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
    ninNumber: row.nin_number ?? null,
    isBlocked: row.is_blocked,
    trialEndsAt: row.trial_ends_at
  };
}

export function toSubscriptionRecord(row: DatabaseSubscription): SubscriptionRecord {
  return {
    agentId: row.agent_id,
    trialStartsAt: row.trial_starts_at,
    trialEndsAt: row.trial_ends_at,
    isActive: row.is_active
  };
}

export function toListingRecord(row: DatabaseListing): ListingRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    title: toTitleCase(row.title),
    description: row.description,
    price: row.price,
    propertyType: row.property_type,
    listingCategory: row.listing_category ?? "for_sale",
    availability: row.availability ?? "available",
    status: row.status,
    imageUrls: row.image_urls ?? [],
    contactPhone: row.contact_phone,
    contactWhatsapp: row.contact_whatsapp,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
