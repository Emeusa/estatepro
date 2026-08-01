export type GuideSection = { heading: string; paragraphs: string[]; checklist?: string[] };

export type PropertyGuide = {
  slug: string;
  title: string;
  description: string;
  author: string;
  reviewer: string;
  publishedAt: string;
  updatedAt: string;
  sources: Array<{ label: string; href: string }>;
  sections: GuideSection[];
};

export const PROPERTY_GUIDES: PropertyGuide[] = [
  {
    slug: "rent-property-safely-in-nigeria",
    title: "How to rent property safely in Nigeria",
    description: "A practical checklist for confirming a property, agent, fees, and rental documents before making payment.",
    author: "C59 Estatehub Editorial Team",
    reviewer: "C59 Estatehub Trust & Safety",
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-01",
    sources: [{ label: "C59 Estatehub Terms and safety rules", href: "/terms" }],
    sections: [
      {
        heading: "Confirm the property and the person advertising it",
        paragraphs: ["Ask for the exact address, inspect the property physically where safe, and confirm that the agent has permission from the landlord or authorised representative."],
        checklist: ["Check the agent profile and contact details", "Confirm current availability", "Compare the advertised price and fees", "Do not rely on photos alone"]
      },
      {
        heading: "Understand every fee before payment",
        paragraphs: ["Request a written breakdown of rent, agency, legal, caution, service, inspection, and other charges. A payment request should match the agreed property and recipient."],
        checklist: ["Get receipts", "Avoid unexplained urgency", "Verify account ownership", "Keep messages and documents"]
      }
    ]
  },
  {
    slug: "buy-land-and-check-title-documents-nigeria",
    title: "Buying land in Nigeria: documents and checks",
    description: "Understand the independent legal, survey, ownership, and planning checks required before buying land in Nigeria.",
    author: "C59 Estatehub Editorial Team",
    reviewer: "C59 Estatehub Trust & Safety",
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-01",
    sources: [{ label: "Federal Ministry of Housing and Urban Development", href: "https://fmhud.gov.ng/" }],
    sections: [
      {
        heading: "Treat every title claim as something to verify",
        paragraphs: ["A document name in an advert is not proof that the seller has a transferable interest. Use an independent property lawyer and surveyor to confirm ownership, boundaries, encumbrances, acquisition status, and required consent."],
        checklist: ["Search relevant land records", "Verify survey coordinates", "Confirm the seller's identity and authority", "Inspect the site and boundaries"]
      },
      {
        heading: "Document the transaction",
        paragraphs: ["Use properly reviewed agreements, record every payment, and complete applicable registration and consent processes. Requirements vary by state and transaction." ]
      }
    ]
  },
  {
    slug: "verify-a-property-agent",
    title: "How to verify a property agent",
    description: "Steps for checking an agent's identity, business presence, mandate, listings, and payment requests.",
    author: "C59 Estatehub Editorial Team",
    reviewer: "C59 Estatehub Trust & Safety",
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-01",
    sources: [{ label: "Corporate Affairs Commission", href: "https://www.cac.gov.ng/" }],
    sections: [
      {
        heading: "Verification is a starting point, not a transaction guarantee",
        paragraphs: ["An approved profile helps establish platform identity, but users must still confirm the agent's authority for the specific property and independently verify documents and payment instructions."],
        checklist: ["Check profile and business name", "Review current listings", "Confirm the property mandate", "Meet or inspect safely", "Report inconsistent information"]
      }
    ]
  },
  {
    slug: "avoid-property-payment-and-inspection-fraud",
    title: "Avoiding property payment and inspection fraud",
    description: "Recognise pressure tactics, false listings, impersonation, and unsafe payment requests in property transactions.",
    author: "C59 Estatehub Editorial Team",
    reviewer: "C59 Estatehub Trust & Safety",
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-01",
    sources: [{ label: "Nigeria Police Force cybercrime information", href: "https://npf.gov.ng/" }],
    sections: [
      {
        heading: "Pause when a payment request creates artificial urgency",
        paragraphs: ["Fraud attempts often rely on pressure, unusually low prices, copied photos, changing account details, or refusal to provide verifiable property information."],
        checklist: ["Verify before paying", "Do not share sensitive identity or banking data", "Keep evidence", "Use the C59 report action when information is suspicious"]
      }
    ]
  },
  {
    slug: "tenant-landlord-agent-property-checklists",
    title: "Property checklists for tenants, landlords, and agents",
    description: "Practical listing, inspection, documentation, handover, and availability checklists for Nigerian property transactions.",
    author: "C59 Estatehub Editorial Team",
    reviewer: "C59 Estatehub Trust & Safety",
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-01",
    sources: [{ label: "C59 Estatehub Terms", href: "/terms" }],
    sections: [
      {
        heading: "For property seekers",
        paragraphs: ["Confirm price, availability, condition, utilities, access, fees, documents, and the person receiving payment before committing." ]
      },
      {
        heading: "For agents and landlords",
        paragraphs: ["Use current photos and accurate descriptions, disclose material conditions and fees, confirm authority to advertise, and mark sold, rented, or booked properties unavailable promptly." ]
      }
    ]
  }
];

export function getPropertyGuide(slug: string) {
  return PROPERTY_GUIDES.find((guide) => guide.slug === slug) ?? null;
}
