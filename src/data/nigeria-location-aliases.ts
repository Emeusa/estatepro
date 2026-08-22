import aliases from "@/data/nigeria-location-aliases.json";

export const NIGERIA_STATE_ALIASES: Record<string, string> = aliases.stateAliases;
export const NIGERIA_LGA_ALIASES: Record<string, Record<string, string>> = aliases.lgaAliases;
