import lgas from "@/data/nigeria-lgas.json";
import states from "@/data/nigeria-states.json";

const STATE_NAME_ALIASES: Record<string, string> = {
  Nassarawa: "Nasarawa"
};

const STATE_DATA_KEYS: Record<string, string> = {
  Nasarawa: "Nassarawa"
};

export const NIGERIA_STATES = (states as string[]).map((state) => STATE_NAME_ALIASES[state] ?? state);
export const NIGERIA_LGAS = lgas as Record<string, string[]>;

export function getLgasForState(state: string) {
  return NIGERIA_LGAS[STATE_DATA_KEYS[state] ?? state] ?? [];
}

export function isNigeriaState(state: string) {
  return NIGERIA_STATES.includes(STATE_NAME_ALIASES[state] ?? state);
}

export function isNigeriaLga(state: string, lga: string) {
  return getLgasForState(state).includes(lga);
}

export function normalizeNigeriaState(state: string) {
  return STATE_NAME_ALIASES[state] ?? state;
}

export function getNigeriaStateStorageValues(state: string) {
  const canonical = normalizeNigeriaState(state);
  return canonical === "Nasarawa" ? ["Nasarawa", "Nassarawa"] : [canonical];
}
