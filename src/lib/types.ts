export type UserRole = "agent" | "client" | "admin";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type ListingStatus = "pending" | "active" | "inactive" | "blocked";
export type PropertyType = "apartment" | "house" | "room" | "land" | "commercial";
export type LegacyPropertyType = "duplex" | "office" | "shop";
export type PropertySubtype =
  | "flat_apartment"
  | "mini_flat"
  | "self_contain"
  | "studio_apartment"
  | "shared_apartment"
  | "serviced_apartment"
  | "maisonette"
  | "penthouse"
  | "block_of_flats"
  | "duplex"
  | "detached_duplex"
  | "semi_detached_duplex"
  | "terraced_duplex"
  | "bungalow"
  | "detached_bungalow"
  | "semi_detached_bungalow"
  | "terraced_bungalow"
  | "terrace_house"
  | "townhouse"
  | "mansion"
  | "villa"
  | "single_room"
  | "room_and_parlour"
  | "boys_quarters"
  | "shared_room"
  | "residential_land"
  | "commercial_land"
  | "industrial_land"
  | "mixed_use_land"
  | "agricultural_land"
  | "joint_venture_land"
  | "waterfront_land"
  | "estate_plot"
  | "other_land"
  | "office"
  | "private_office"
  | "coworking_space"
  | "workstation"
  | "conference_room"
  | "shop"
  | "showroom"
  | "plaza_mall_complex"
  | "warehouse"
  | "factory"
  | "filling_station"
  | "event_hall"
  | "hotel"
  | "guest_house"
  | "resort"
  | "restaurant_bar"
  | "school"
  | "hospital_clinic"
  | "religious_property"
  | "commercial_building"
  | "other_commercial";
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
export type BillingProvider = "paystack" | "opay" | "manual";
export type BillingMode = "recurring" | "prepaid";
export type PaystackCheckoutChannel = "bank_transfer" | "ussd" | "bank";
export type PromotionCreditType = "boost" | "featured" | "sponsored";
export type AnalyticsLevel = "none" | "basic" | "advanced";
export type ListingReportReason =
  | "fake"
  | "unavailable"
  | "duplicate"
  | "wrong_price"
  | "scam"
  | "payment_request"
  | "impersonation"
  | "unsafe_agent"
  | "other";
export type ListingReportStatus = "open" | "reviewing" | "reviewed" | "dismissed" | "resolved";
export type ListingReportSeverity = "low" | "medium" | "high" | "critical";
export type ListingReportActionTaken =
  | "none"
  | "listing_hidden"
  | "agent_blocked"
  | "agent_contacted"
  | "duplicate_merged"
  | "other";
export type AdminNotificationPriority = "normal" | "high" | "critical";

export type LocationValue = {
  state: string;
  city: string;
  area: string;
  areaSlug?: string;
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
  businessName: string | null;
  ninNumber: string | null;
  cacNumber: string | null;
  isBlocked: boolean;
  trialEndsAt: string;
};

export type ListingRecord = {
  id: string;
  slug: string;
  agentId: string;
  title: string;
  description: string;
  price: number;
  propertyType: PropertyType;
  propertySubtype?: PropertySubtype | null;
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
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
  retentionUntil?: string | null;
  mediaDeleteAfter?: string | null;
  hardDeleteAfter?: string | null;
  mediaDeletedAt?: string | null;
  legalHoldUntil?: string | null;
  agentKeepActivePriority?: number | null;
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

export type PublicListingCardRecord = Pick<
  ListingRecord,
  | "id"
  | "slug"
  | "title"
  | "price"
  | "propertyType"
  | "propertySubtype"
  | "listingCategory"
  | "availability"
  | "status"
  | "updatedAt"
  | "imageUrls"
  | "imageVariants"
  | "promotionType"
  | "featuredUntil"
  | "sponsoredUntil"
  | "location"
  | "bedrooms"
  | "bathrooms"
  | "toilets"
  | "parkingSpaces"
  | "propertySize"
  | "propertySizeUnit"
  | "landSize"
  | "landSizeUnit"
> & {
  imageCount: number;
  descriptionPreview: string;
  contactPhone: string;
  contactWhatsapp: string;
  cardFeatureBadges: string[];
  agentName: string | null;
  agentIsVerified: boolean;
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

export type SubscriptionAdminGrantRecord = {
  id: string;
  agentId: string;
  adminId: string | null;
  planSlug: string;
  periodStart: string;
  periodEnd: string | null;
  reason: string;
  previousPlanSlug: string | null;
  previousStatus: string | null;
  previousPeriodEnd: string | null;
  createdAt: string;
};

export type PromotionCreditSummary = {
  creditType: PromotionCreditType;
  quantity: number;
  remaining: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export type AgentEntitlements = {
  planSlug: string;
  planName: string;
  activeListingLimit: number;
  activeListingCount: number;
  autoRefreshDays: number | null;
  analyticsLevel: AnalyticsLevel;
  hasPriorityReview: boolean;
  hasPrioritySupport: boolean;
  credits: Record<PromotionCreditType, PromotionCreditSummary>;
  periodStart: string | null;
  periodEnd: string | null;
};

export type AgentAnalyticsSummary = {
  range: "7d" | "30d";
  analyticsLevel: AnalyticsLevel;
  totals: {
    listingViews: number;
    detailViews: number;
    whatsappClicks: number;
    phoneClicks: number;
    saves: number;
    reports: number;
  };
  listings: Array<{
    listingId: string;
    title: string;
    impressions: number;
    detailViews: number;
    whatsappClicks: number;
    phoneClicks: number;
  }>;
};

export type SupportRequestRecord = {
  id: string;
  agentId: string;
  agentName?: string | null;
  agentEmail?: string | null;
  priority: "normal" | "priority" | "highest";
  subject: string;
  message: string;
  status: "open" | "reviewing" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
};

export type ListingReportRecord = {
  id: string;
  listingId: string;
  listingTitle?: string | null;
  listingStatus?: ListingStatus | null;
  listingAvailability?: ListingAvailability | null;
  agentId?: string | null;
  agentName?: string | null;
  agentEmail?: string | null;
  reporterUserId: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  reason: ListingReportReason;
  details: string;
  status: ListingReportStatus;
  severity: ListingReportSeverity;
  adminNotes: string | null;
  resolutionNotes: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  assignedAdminId: string | null;
  actionTaken: ListingReportActionTaken | null;
  createdAt: string;
  updatedAt: string;
};

export type ListingReportStats = {
  openReports: number;
  highRiskReports: number;
  needsReview: number;
  recentReports: ListingReportRecord[];
};

export type AdminNotificationRecord = {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: AdminNotificationPriority;
  entityType: string;
  entityId: string | null;
  href: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
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
  propertySubtype?: PropertySubtype;
  areaSlug?: string;
  listingCategory?: ListingCategory;
  page?: number;
  limit?: number;
};

export type PaginationMetadata = {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: PaginationMetadata;
};

export type AdminListingRankingRecord = {
  position: number;
  listingId: string;
  slug: string;
  title: string;
  agentId: string;
  agentName: string | null;
  listingCategory: ListingCategory;
  location: LocationValue;
  promotionTier: "premium" | "sponsored" | "regular";
  fixedPremiumSlot: boolean;
  qualityScore: number;
  freshnessScore: number;
  freshnessSource: "boost" | "plan_refresh" | "created";
  freshnessAt: string;
  promotionBonus: number;
  baseScore: number;
  finalScore: number;
  diversityAdjustments: Array<"page_limit" | "consecutive_limit" | "relaxed">;
};

export type AdminListingRankingResponse = {
  items: AdminListingRankingRecord[];
  pagination: PaginationMetadata;
  snapshotAt: string;
};

export type PublicMarketFacet = {
  state: string;
  city: string;
  area: string;
  areaSlug: string;
  listingCategory: ListingCategory;
  propertyType: PropertyType;
  propertySubtype: PropertySubtype | null;
  listingCount: number;
  latestUpdatedAt: string;
  listingFingerprints: string[];
};

export type PublicMarketPage = {
  items: PublicListingCardRecord[];
  listingCount: number;
  latestUpdatedAt: string | null;
  duplicateRatio: number;
  currentPage: number;
  totalPages: number;
  activeCities: Array<{ name: string; count: number }>;
  activePropertyTypes: Array<{ propertyType: PropertyType; count: number }>;
  activeAreas: Array<{ name: string; slug: string; count: number }>;
  activePropertySubtypes: Array<{ propertySubtype: PropertySubtype; count: number }>;
};

export type SeoMarketCoverageRecord = {
  path: string;
  pageType: string;
  label: string;
  listingCount: number;
  latestUpdatedAt: string | null;
  isIndexable: boolean;
  isInGracePeriod: boolean;
  reason: string;
  inSitemap: boolean;
};

export type AdminAgentReview = {
  user: UserRecord;
  agent: AgentProfile;
  listings: ListingRecord[];
};

export type PaidPlanStats = {
  totalPaidAgents: number;
  starterAgent: number;
  growthAgent: number;
  proAgent: number;
  agencyPlus: number;
};

export type AdminAgentSummary = {
  user: UserRecord;
  agent: AgentProfile;
  listingCount: number;
};

export type AdminAgentDetails = AdminAgentSummary & {
  listings: ListingRecord[];
  listingPagination: PaginationMetadata;
  subscription: SubscriptionRecord | null;
  subscriptionGrants: SubscriptionAdminGrantRecord[];
};

export type PublicAgentSummary = {
  id: string;
  fullName: string;
  businessName: string | null;
  displayName: string;
  isVerified: boolean;
};

export type PublicListingDetails = {
  listing: ListingRecord;
  agent: PublicAgentSummary;
};
