export type UserRole = "agent" | "client" | "admin";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type ListingStatus = "pending" | "active" | "blocked";
export type PropertyType = "apartment" | "duplex" | "land" | "office" | "shop";
export type ListingCategory = "for_sale" | "for_rent" | "short_let";
export type ListingAvailability = "available" | "sold" | "rented" | "booked";

export type LocationValue = {
  state: string;
  city: string;
  area: string;
  slug: string;
};

export type UserRecord = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
};

export type AgentProfile = {
  id: string;
  verificationStatus: VerificationStatus;
  verificationDocuments: string[];
  isBlocked: boolean;
  trialEndsAt: string;
};

export type ListingRecord = {
  id: string;
  agentId: string;
  title: string;
  description: string;
  price: number;
  propertyType: PropertyType;
  listingCategory: ListingCategory;
  availability: ListingAvailability;
  status: ListingStatus;
  imageUrls: string[];
  contactPhone: string;
  contactWhatsapp: string;
  location: LocationValue;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionRecord = {
  agentId: string;
  trialStartsAt: string;
  trialEndsAt: string;
  isActive: boolean;
};

export type ListingFilters = {
  location?: string;
  state?: string;
  city?: string;
  maxPrice?: number;
  propertyType?: PropertyType;
  cursor?: string;
  limit?: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
};

export type AdminAgentReview = {
  user: UserRecord;
  agent: AgentProfile;
  listings: ListingRecord[];
};

export type PublicAgentSummary = {
  id: string;
  fullName: string;
  isVerified: boolean;
};

export type PublicListingDetails = {
  listing: ListingRecord;
  agent: PublicAgentSummary;
};
