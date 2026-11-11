import type { CareerGroup } from "../ids.ts";

/**
 * Every job in worlds/alexandria-0.33.0.json, grouped for NPC action menus.
 * Within a group, jobs run from lowest to highest tier; the last reached job
 * in this order is a life's peak job.
 */
export const CAREER_GROUP_JOBS: Record<CareerGroup, readonly string[]> = Object.freeze({
  letters: Object.freeze(["copyist", "clerk", "philosophy-tutor", "patron-supported-reader", "court-adviser"]),
  military: Object.freeze(["soldier", "officer", "general"]),
  commerce: Object.freeze(["porter", "sailor", "shopkeeper"]),
  craft: Object.freeze([
    "apprentice", "potter", "ceramic-decorator", "wood-carver", "sculptor",
    "pottery-workshop-lead", "carving-workshop-lead", "sculpture-workshop-lead",
  ]),
  sky: Object.freeze(["astrologer", "sky-table-calculator"]),
  performance: Object.freeze(["performer"]),
});
