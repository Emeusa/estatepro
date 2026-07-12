export type PricingPlanSlug =
  | "free_starter"
  | "starter_agent"
  | "growth_agent"
  | "pro_agent"
  | "agency_plus"
  | "developer_enterprise";

export type PricingPlan = {
  slug: PricingPlanSlug;
  name: string;
  priceMonthly: number | null;
  activeListings: number | null;
  manualBoosts: number | null;
  autoRefreshDays: number | null;
  featuredCredits: number | null;
  sponsoredSlots: number | null;
  description: string;
  features: string[];
  isPopular?: boolean;
};

export type PlanFeatureDisplayRow = {
  key: string;
  label: string;
  value: string;
  helpText: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    slug: "free_starter",
    name: "Free Starter",
    priceMonthly: 0,
    activeListings: 3,
    manualBoosts: 0,
    autoRefreshDays: null,
    featuredCredits: 0,
    sponsoredSlots: 0,
    description: "Remove signup friction while agents build trust and inventory.",
    features: ["3 active listings", "Verified agent eligibility", "Agent profile page", "Direct call and WhatsApp links"]
  },
  {
    slug: "starter_agent",
    name: "Starter Agent",
    priceMonthly: 7500,
    activeListings: 20,
    manualBoosts: 5,
    autoRefreshDays: 21,
    featuredCredits: 0,
    sponsoredSlots: 0,
    description: "Affordable visibility for small agents.",
    features: ["20 active listings", "5 manual boosts monthly", "Auto refresh every 21 days", "Basic analytics"]
  },
  {
    slug: "growth_agent",
    name: "Growth Agent",
    priceMonthly: 14900,
    activeListings: 80,
    manualBoosts: 20,
    autoRefreshDays: 10,
    featuredCredits: 5,
    sponsoredSlots: 0,
    description: "Best launch plan for serious agents who need more reach.",
    features: ["80 active listings", "20 manual boosts monthly", "5 featured credits", "Priority verification review"],
    isPopular: true
  },
  {
    slug: "pro_agent",
    name: "Pro Agent",
    priceMonthly: 29900,
    activeListings: 250,
    manualBoosts: 60,
    autoRefreshDays: 5,
    featuredCredits: 20,
    sponsoredSlots: 3,
    description: "For agencies that need consistent search visibility.",
    features: [
      "250 active listings",
      "60 manual boosts monthly",
      "20 featured credits",
      "3 sponsored search slots",
      "Agency name watermark"
    ]
  },
  {
    slug: "agency_plus",
    name: "Agency Plus",
    priceMonthly: 59900,
    activeListings: 750,
    manualBoosts: 150,
    autoRefreshDays: 3,
    featuredCredits: 50,
    sponsoredSlots: 8,
    description: "High-volume agency visibility with priority support.",
    features: [
      "750 active listings",
      "150 manual boosts monthly",
      "50 featured credits",
      "8 sponsored search slots",
      "Agency name watermark",
      "Priority support"
    ]
  },
  {
    slug: "developer_enterprise",
    name: "Developer / Enterprise",
    priceMonthly: null,
    activeListings: null,
    manualBoosts: null,
    autoRefreshDays: null,
    featuredCredits: null,
    sponsoredSlots: null,
    description: "Custom visibility for developers, projects, and large campaigns.",
    features: ["Project pages", "Homepage features", "Area sponsorship", "Bulk upload support", "Banner placements"]
  }
];

export const ADD_ON_PRICING = [
  { name: "Manual Boost", price: "NGN 500 per boost" },
  { name: "Featured Listing", price: "NGN 2,500/day or NGN 10,000/week" },
  { name: "Sponsored Search Slot", price: "NGN 15,000/week" },
  { name: "Homepage Feature", price: "NGN 30,000/week" },
  { name: "Inline Banner Ad", price: "NGN 40,000/month launch price" },
  { name: "Verified Photo Badge", price: "Free after admin confirmation" }
];

const FEATURE_HELP = {
  activeListings:
    "The maximum number of available listings you can publish at the same time. Sold, rented, booked, or inactive listings stay in your account but do not count toward the main discovery feed.",
  manualBoosts:
    "A manual boost refreshes one listing's visibility signal so it can compete higher again without changing the original creation date. Use boosts on listings you want more people to see.",
  autoRefresh:
    "Auto refresh periodically renews eligible listings for you, so older active listings do not become buried as quickly. The shorter the interval, the more often the plan refreshes visibility.",
  featuredCredits:
    "Featured credits are used to give selected listings stronger visibility, such as future featured areas or highlighted placement. Listings must still be approved, active, available, and safe.",
  sponsoredSlots:
    "Sponsored search slots are paid, labelled placements for high-intent searches. They improve exposure but do not bypass agent approval, listing quality, availability, or safety checks.",
  basicAnalytics:
    "Basic analytics helps you understand interest in your listings, such as views, calls, WhatsApp clicks, and contact activity when tracking is available.",
  priorityVerification:
    "Priority verification moves your review ahead in the admin queue, but approval still depends on valid agent information and compliance with platform rules.",
  prioritySupport:
    "Priority support gives faster help with account, billing, listing visibility, and publishing issues.",
  verifiedAgentEligibility:
    "You can apply to become a verified agent. Verification helps users trust your listings and unlocks public visibility after admin approval.",
  agentProfile:
    "Your public agent profile lets property seekers browse your active listings and contact details from one place.",
  directContact:
    "Call and WhatsApp buttons let serious property seekers contact you quickly from listing pages.",
  projectPages:
    "Custom project pages are dedicated pages for estates, developments, or large property campaigns.",
  homepageFeatures:
    "Homepage features place selected projects or campaigns in premium homepage positions after manual approval.",
  areaSponsorship:
    "Area sponsorship gives a developer or agency premium visibility around a chosen city, LGA, or neighbourhood campaign.",
  bulkUpload:
    "Bulk upload support helps high-volume teams publish many listings faster without entering each property manually.",
  bannerPlacements:
    "Banner placements are custom advertising positions for larger campaigns and are configured manually with the C59 Estatehub team.",
  photoWatermark:
    "New optimized listing photos receive a transparent watermark to discourage copying. Pro and Agency Plus use the agent or agency name; lower plans use the C59 Estatehub watermark."
} as const;

const CUMULATIVE_FEATURES: Array<PlanFeatureDisplayRow & { minRank: number }> = [
  {
    minRank: 0,
    key: "verified-agent-eligibility",
    label: "Verified agent eligibility",
    value: "Included",
    helpText: FEATURE_HELP.verifiedAgentEligibility
  },
  {
    minRank: 0,
    key: "agent-profile-page",
    label: "Agent profile page",
    value: "Included",
    helpText: FEATURE_HELP.agentProfile
  },
  {
    minRank: 0,
    key: "direct-contact-links",
    label: "Direct contact links",
    value: "Included",
    helpText: FEATURE_HELP.directContact
  },
  {
    minRank: 1,
    key: "basic-analytics",
    label: "Basic analytics",
    value: "Included",
    helpText: FEATURE_HELP.basicAnalytics
  },
  {
    minRank: 2,
    key: "priority-review",
    label: "Priority review",
    value: "Included",
    helpText:
      "Paid Growth and higher agents are marked as priority in admin review/support workflows. This does not bypass safety checks or approval rules."
  },
  {
    minRank: 3,
    key: "advanced-analytics",
    label: "Advanced analytics",
    value: "Included",
    helpText:
      "Advanced analytics adds listing-level performance so you can see which properties generate views, calls, and WhatsApp interest."
  },
  {
    minRank: 4,
    key: "priority-support",
    label: "Priority support",
    value: "Included",
    helpText: FEATURE_HELP.prioritySupport
  },
  {
    minRank: 5,
    key: "project-pages",
    label: "Project pages",
    value: "Custom",
    helpText: FEATURE_HELP.projectPages
  },
  {
    minRank: 5,
    key: "homepage-features",
    label: "Homepage features",
    value: "Custom",
    helpText: FEATURE_HELP.homepageFeatures
  },
  {
    minRank: 5,
    key: "area-sponsorship",
    label: "Area sponsorship",
    value: "Custom",
    helpText: FEATURE_HELP.areaSponsorship
  },
  {
    minRank: 5,
    key: "bulk-upload",
    label: "Bulk upload support",
    value: "Custom",
    helpText: FEATURE_HELP.bulkUpload
  },
  {
    minRank: 5,
    key: "banner-placements",
    label: "Banner placements",
    value: "Custom",
    helpText: FEATURE_HELP.bannerPlacements
  }
];

function monthlyValue(value: number | null, unit: string) {
  if (value === null) {
    return "Custom";
  }

  return value > 0 ? `${value} ${unit}/month` : "Not included";
}

function autoRefreshValue(plan: PricingPlan) {
  if (plan.autoRefreshDays === null) {
    return plan.priceMonthly === null ? "Custom" : "Manual only";
  }

  return `Every ${plan.autoRefreshDays} days`;
}

export const PAID_PLAN_SLUGS = [
  "starter_agent",
  "growth_agent",
  "pro_agent",
  "agency_plus"
] as const;

export type PaidPricingPlanSlug = (typeof PAID_PLAN_SLUGS)[number];

export function getPricingPlan(slug?: string | null) {
  return PRICING_PLANS.find((plan) => plan.slug === slug) ?? PRICING_PLANS[0];
}

export function formatPlanPrice(price: number | null) {
  return price === null ? "Custom" : price === 0 ? "NGN 0/mo" : `NGN ${price.toLocaleString("en-NG")}/mo`;
}

export function getPlanFeatureRows(plan: PricingPlan): PlanFeatureDisplayRow[] {
  const baseRows: PlanFeatureDisplayRow[] = [
    {
      key: "active-listings",
      label: "Active listings",
      value: plan.activeListings === null ? "Custom limit" : `${plan.activeListings} listings`,
      helpText: FEATURE_HELP.activeListings
    },
    {
      key: "manual-boosts",
      label: "Manual boosts",
      value: monthlyValue(plan.manualBoosts, "boosts"),
      helpText: FEATURE_HELP.manualBoosts
    },
    {
      key: "auto-refresh",
      label: "Auto refresh",
      value: autoRefreshValue(plan),
      helpText: FEATURE_HELP.autoRefresh
    },
    {
      key: "featured-credits",
      label: "Featured credits",
      value: monthlyValue(plan.featuredCredits, "credits"),
      helpText: FEATURE_HELP.featuredCredits
    },
    {
      key: "sponsored-slots",
      label: "Sponsored search slots",
      value: monthlyValue(plan.sponsoredSlots, "slots"),
      helpText: FEATURE_HELP.sponsoredSlots
    },
    {
      key: "photo-watermark",
      label: "Photo watermark",
      value: getPlanRank(plan.slug) >= 3 ? "Agency name" : "C59 watermark",
      helpText: FEATURE_HELP.photoWatermark
    }
  ];

  const inheritedRows = CUMULATIVE_FEATURES
    .filter((feature) => feature.minRank <= getPlanRank(plan.slug))
    .map((feature) => ({
      key: feature.key,
      label: feature.label,
      value: feature.value,
      helpText: feature.helpText
    }));

  return [...baseRows, ...inheritedRows];
}

export function isPaidPricingPlanSlug(slug: string): slug is PaidPricingPlanSlug {
  return PAID_PLAN_SLUGS.includes(slug as PaidPricingPlanSlug);
}

export function getActiveListingLimit(planSlug?: string | null) {
  return getPricingPlan(planSlug).activeListings ?? 3;
}

export function getPlanAmountKobo(planSlug: PaidPricingPlanSlug) {
  return (getPricingPlan(planSlug).priceMonthly ?? 0) * 100;
}

const PLAN_RANKS: Record<PricingPlanSlug, number> = {
  free_starter: 0,
  starter_agent: 1,
  growth_agent: 2,
  pro_agent: 3,
  agency_plus: 4,
  developer_enterprise: 5
};

export function getPlanRank(planSlug?: string | null) {
  const plan = getPricingPlan(planSlug);
  return PLAN_RANKS[plan.slug];
}

export function isLowerPlan(currentPlanSlug: string | null | undefined, targetPlanSlug: string | null | undefined) {
  return getPlanRank(targetPlanSlug) < getPlanRank(currentPlanSlug);
}

export function isHigherPlan(currentPlanSlug: string | null | undefined, targetPlanSlug: string | null | undefined) {
  return getPlanRank(targetPlanSlug) > getPlanRank(currentPlanSlug);
}

export function getPlanAnalyticsLevel(planSlug?: string | null) {
  const rank = getPlanRank(planSlug);
  if (rank >= 3) {
    return "advanced" as const;
  }
  if (rank >= 1) {
    return "basic" as const;
  }
  return "none" as const;
}

export function hasPriorityReview(planSlug?: string | null) {
  return getPlanRank(planSlug) >= 2;
}

export function hasPrioritySupport(planSlug?: string | null) {
  return getPlanRank(planSlug) >= 4;
}
