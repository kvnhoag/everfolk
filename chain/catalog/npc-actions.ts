import type { CareerGroup } from "../ids.ts";

/**
 * Every job in worlds/alexandria-0.33.0.json, grouped for NPC action menus.
 * Within a group, jobs run from lowest to highest tier; the last reached job
 * in this order is a life's peak job.
 */
export const CAREER_GROUP_JOBS: Record<CareerGroup, readonly string[]> = Object.freeze({
  letters: Object.freeze(["copyist", "clerk", "philosophy-tutor", "patron-supported-reader", "court-adviser", "scientist", "politician"]),
  military: Object.freeze(["soldier", "officer", "general"]),
  commerce: Object.freeze(["porter", "sailor", "shopkeeper", "merchant", "trading-house-manager"]),
  craft: Object.freeze([
    "apprentice", "tailor", "potter", "ceramic-decorator", "wood-carver", "sculptor",
    "pottery-workshop-lead", "carving-workshop-lead", "sculpture-workshop-lead",
    "tailor", "master-tailor", "master-potter", "master-sculptor",
  ]),
  sky: Object.freeze(["astrologer", "sky-table-calculator"]),
  performance: Object.freeze(["performer"]),
  farming: Object.freeze(["farmhand", "tenant-farmer", "grain-dealer", "master-cultivator", "master-household-farmer"]),
});

/** New occupations must not shift the deployed ranked catalog's existing job tiers. */
export const ADDITIONAL_JOB_TIERS: Readonly<Record<string, number>> = Object.freeze({
  tailor: 1, "master-tailor": 8, "master-potter": 8, "master-sculptor": 8,
  scientist: 5, politician: 5,
});
