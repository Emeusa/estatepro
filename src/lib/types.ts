export type UserRole = "agent" | "client" | "admin";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type ListingStatus = "pending" | "active" | "blocked";
export type PropertyType = "apartment" | "duplex" | "land" | "office" | "shop";
export type ListingCategory = "for_sale" | "for_rent" | "short_let";
export type ListingAvailability = "available" | "sold" | "rented" | "booked";
export type ListingPromotionType = "standard" | "premium" | "featured" | "sponsored";
export type PropertySizeUnit = "sqm" | "sqft";
export type LandSizeUnit = "sqm" | "plots" | "acres" | "hectares";
export type FurnishingStatus = "unfurnished" | "semi_furnished" | "furnished";
export type ServicingStatus = "unserviced" | "partly_serviced" | "serviced";
export type PropertyCondition = "newly_built" | "renovated" | "fairly_used" | "needs_renovation";
export type TitleDocumentType =
  | "certificate_of_occupancy"
  | "governors_consent"
  | "registered_survey"
  | "deed_of_assignment"
  | "excision"
  | "gazette"
  | "receipt"
  | "other";
export type ZoningType = "residential" | "commercial" | "mixed_use" | "industrial" | "agricultural";
export type RoadAccess = "tarred" | "untarred" | "estate_road" | "major_road" | "none";
export type BillingProvider = "paystack" | "opay";
export type BillingMode = "recurring" | "prepaid";

export type LocationValue = {
  state: string;
  city: string;
  area: string;
  slug: string;
};

export type ListingImageVariant = {
  heroUrl: string;
  cardUrl: string;
  blurDataUrl: string | null;
  width: number | null;
  height: number | null;
  cardWidth: number | null;
  cardHeight: number | null;
  order: number;
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
  ninNumber: string | null;
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
  imageVariants: ListingImageVariant[];
  promotionType?: ListingPromotionType | null;
  boostedAt?: string | null;
  lastRefreshedAt?: string | null;
  expiresAt?: string | null;
  featuredUntil?: string | null;
  sponsoredUntil?: string | null;
  photosVerifiedAt?: string | null;
  contactPhone: string;
  contactWhatsapp: string;
  location: LocationValue;
  bedrooms: number | null;
  bathrooms: number | null;
  toilets: number | null;
  parkingSpaces: number | null;
  propertySize: number | null;
  propertySizeUnit: PropertySizeUnit | null;
  yearBuilt: number | null;
  floorLevel: number | null;
  totalFloors: number | null;
  furnishingStatus: FurnishingStatus | null;
  servicingStatus: ServicingStatus | null;
  propertyCondition: PropertyCondition | null;
  amenities: string[];
  utilities: string[];
  safetyFeatures: string[];
  nearbyLandmarks: string[];
  extraFeatures: string[];
  landSize: number | null;
  landSizeUnit: LandSizeUnit | null;
  titleDocumentType: TitleDocumentType | null;
  zoningType: ZoningType | null;
  roadAccess: RoadAccess | null;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionRecord = {
  agentId: string;
  planSlug: string;
  paymentProvider: BillingProvider;
  billingMode: BillingMode;
  trialStartsAt: string;
  trialEndsAt: string;
  isActive: boolean;
  status: "trialing" | "active" | "past_due" | "cancelled" | "inactive";
  paystackCustomerCode: string | null;
  paystackSubscriptionCode: string | null;
  paystackEmailToken: string | null;
  paystackPlanCode: string | null;
  opayOrderNo: string | null;
  opayTransactionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type ListingFilters = {
  keyword?: string;
  location?: string;
  state?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: PropertyType;
  listingCategory?: ListingCategory;
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

export type AdminAgentSummary = {
  user: UserRecord;
  agent: AgentProfile;
  listingCount: number;
};

export type AdminAgentDetails = AdminAgentSummary & {
  listings: ListingRecord[];
  subscription: SubscriptionRecord | null;
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
