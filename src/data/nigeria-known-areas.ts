export type KnownNigeriaArea = {
  state: string;
  city: string;
  canonicalName: string;
  slug: string;
  aliases: string[];
};

// Only high-confidence locality/LGA mappings belong here. Unknown localities
// are registered automatically under the LGA selected by the agent.
export const KNOWN_NIGERIA_AREAS: KnownNigeriaArea[] = [
  { state: "Lagos", city: "Eti-Osa", canonicalName: "Ajah", slug: "ajah", aliases: ["ajah lekki"] },
  { state: "Lagos", city: "Eti-Osa", canonicalName: "Sangotedo", slug: "sangotedo", aliases: ["sangotedo ajah", "sangotedo-ajah", "lekki phase 2 sangotedo", "lekki-phase-2-sangotedo"] },
  { state: "Lagos", city: "Eti-Osa", canonicalName: "Banana Island", slug: "banana-island", aliases: ["banana island ikoyi"] },
  { state: "Lagos", city: "Eti-Osa", canonicalName: "Carlton Gate Estate", slug: "carlton-gate-estate", aliases: ["carlton gate", "carlton gate chevron", "carlton gate estate off chevron drive"] },
  { state: "Lagos", city: "Eti-Osa", canonicalName: "Chevron", slug: "chevron", aliases: ["chevron drive", "chevron lekki"] },
  { state: "Lagos", city: "Eti-Osa", canonicalName: "Orchid Road", slug: "orchid-road", aliases: ["orchid road chevron"] },
  { state: "Lagos", city: "Eti-Osa", canonicalName: "Lekki Phase 1", slug: "lekki-phase-1", aliases: ["lekki phase one"] },
  { state: "Lagos", city: "Eti-Osa", canonicalName: "Lekki Phase 2", slug: "lekki-phase-2", aliases: ["lekki phase two"] },
  { state: "Lagos", city: "Eti-Osa", canonicalName: "Victoria Island", slug: "victoria-island", aliases: ["vi lagos"] }
];

function normalizeAreaKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveKnownNigeriaArea(state: string, value: string) {
  const key = normalizeAreaKey(value);
  return KNOWN_NIGERIA_AREAS.find((area) =>
    area.state === state
    && [area.slug, area.canonicalName, ...area.aliases].some((candidate) => normalizeAreaKey(candidate) === key)
  ) ?? null;
}
