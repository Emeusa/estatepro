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
    features: ["250 active listings", "60 manual boosts monthly", "20 featured credits", "3 sponsored search slots"]
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
    features: ["750 active listings", "150 manual boosts monthly", "50 featured credits", "8 sponsored search slots", "Priority support"]
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

export function isPaidPricingPlanSlug(slug: string): slug is PaidPricingPlanSlug {
  return PAID_PLAN_SLUGS.includes(slug as PaidPricingPlanSlug);
}

export function getActiveListingLimit(planSlug?: string | null) {
  return getPricingPlan(planSlug).activeListings ?? 3;
}

export function getPlanAmountKobo(planSlug: PaidPricingPlanSlug) {
  return (getPricingPlan(planSlug).priceMonthly ?? 0) * 100;
}
