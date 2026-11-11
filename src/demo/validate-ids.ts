import { GOODS, LIVESTOCK } from "./types.ts";
export const ANIMAL_OR_GOOD: readonly string[] = [...GOODS, ...LIVESTOCK];
export const CONDITION_FAMILIES: readonly string[] = ["flood", "army", "road"];
