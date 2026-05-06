import lgas from "@/data/nigeria-lgas.json";
import states from "@/data/nigeria-states.json";

export const NIGERIA_STATES = states as string[];
export const NIGERIA_LGAS = lgas as Record<string, string[]>;

export function getLgasForState(state: string) {
  return NIGERIA_LGAS[state] ?? [];
}

export function isNigeriaState(state: string) {
  return NIGERIA_STATES.includes(state);
}

export function isNigeriaLga(state: string, lga: string) {
  return getLgasForState(state).includes(lga);
}
