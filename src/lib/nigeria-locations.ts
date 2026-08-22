import { NIGERIA_LGA_ALIASES, NIGERIA_STATE_ALIASES } from "@/data/nigeria-location-aliases";
import lgas from "@/data/nigeria-lgas.json";
import states from "@/data/nigeria-states.json";

function normalizeLocationKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const NIGERIA_STATES = states as string[];
export const NIGERIA_LGAS = lgas as Record<string, string[]>;

const stateByKey = new Map(
  NIGERIA_STATES.map((state) => [normalizeLocationKey(state), state] as const)
);

const lgaByStateAndKey = new Map(
  NIGERIA_STATES.flatMap((state) =>
    (NIGERIA_LGAS[state] ?? []).map((lga) => [`${state}|${normalizeLocationKey(lga)}`, lga] as const)
  )
);

const lgaAliasByStateAndKey = new Map(
  Object.entries(NIGERIA_LGA_ALIASES).flatMap(([state, aliases]) =>
    Object.entries(aliases).map(([alias, canonical]) => [
      `${state}|${normalizeLocationKey(alias)}`,
      canonical
    ] as const)
  )
);

export function getLgasForState(state: string) {
  return NIGERIA_LGAS[normalizeNigeriaState(state)] ?? [];
}

export function isNigeriaState(state: string) {
  const key = normalizeLocationKey(state);
  return stateByKey.has(key) || Boolean(NIGERIA_STATE_ALIASES[key]);
}

export function normalizeNigeriaState(state: string) {
  const key = normalizeLocationKey(state);
  return NIGERIA_STATE_ALIASES[key] ?? stateByKey.get(key) ?? state.trim();
}

export function normalizeNigeriaLga(state: string, lga: string) {
  const canonicalState = normalizeNigeriaState(state);
  const key = normalizeLocationKey(lga);
  return lgaAliasByStateAndKey.get(`${canonicalState}|${key}`)
    ?? lgaByStateAndKey.get(`${canonicalState}|${key}`)
    ?? lga.trim();
}

export function isNigeriaLga(state: string, lga: string) {
  const canonicalState = normalizeNigeriaState(state);
  const canonicalLga = normalizeNigeriaLga(canonicalState, lga);
  return getLgasForState(canonicalState).includes(canonicalLga);
}

export function getNigeriaStateStorageValues(state: string) {
  const canonical = normalizeNigeriaState(state);
  return canonical === "Nasarawa" ? ["Nasarawa", "Nassarawa"] : [canonical];
}

export function getNigeriaLgaStorageValues(state: string, lga: string) {
  const canonicalState = normalizeNigeriaState(state);
  const canonical = normalizeNigeriaLga(canonicalState, lga);
  const aliases = Object.entries(NIGERIA_LGA_ALIASES[canonicalState] ?? {})
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias);
  return Array.from(new Set([canonical, ...aliases]));
}

export function getNigeriaLocationRegistryStats() {
  return {
    states: NIGERIA_STATES.length,
    lgas: Object.values(NIGERIA_LGAS).reduce((total, stateLgas) => total + stateLgas.length, 0)
  };
}

export function getNigeriaLocationSearchEntries() {
  const states = NIGERIA_STATES.flatMap((state) => {
    const aliases = Object.entries(NIGERIA_STATE_ALIASES)
      .filter(([, canonical]) => canonical === state)
      .map(([alias]) => alias);
    return [state, ...aliases].map((term) => ({ term, state }));
  });
  const lgas = NIGERIA_STATES.flatMap((state) => {
    const canonical = getLgasForState(state).map((city) => ({ term: city, state, city }));
    const aliases = Object.entries(NIGERIA_LGA_ALIASES[state] ?? {}).map(([term, city]) => ({
      term,
      state,
      city
    }));
    return [...canonical, ...aliases];
  });
  return { states, lgas };
}
