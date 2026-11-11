/** Stable identifiers shared by the contract, verifier and client. Changing one breaks minted tokens. */
export const FIGURE_IDS = ["alexander", "aristotle", "euclid", "cleomenes"] as const;
export const CATEGORIES = ["education", "war", "money", "work", "fate", "spirit"] as const;
export const CAREER_GROUPS = ["letters", "military", "commerce", "craft", "sky", "performance"] as const;

export type FigureId = typeof FIGURE_IDS[number];
export type Category = typeof CATEGORIES[number];
export type CareerGroup = typeof CAREER_GROUPS[number];

export const FIGURE_ACTIONS = {
  alexander: ["alexander.levy", "alexander.found"],
  aristotle: ["aristotle.lyceum", "aristotle.tutor-court"],
  euclid: ["euclid.school", "euclid.museum"],
  cleomenes: ["cleomenes.corner-grain", "cleomenes.granaries"],
} as const satisfies Record<FigureId, readonly string[]>;

export const NPC_ACTIONS = {
  letters: { category: "education", actions: ["letters.teach", "letters.lend-books"] },
  military: { category: "war", actions: ["military.mentor", "military.warn-levy"] },
  commerce: { category: "money", actions: ["commerce.credit", "commerce.hire"] },
  craft: { category: "work", actions: ["craft.apprentice", "craft.commission"] },
  sky: { category: "fate", actions: ["sky.omen", "sky.warn-year"] },
  performance: { category: "spirit", actions: ["performance.lift", "performance.lend-hand"] },
} as const satisfies Record<CareerGroup, { category: Category; actions: readonly string[] }>;

export type FigureActionId = typeof FIGURE_ACTIONS[FigureId][number];
export type NpcActionId = typeof NPC_ACTIONS[CareerGroup]["actions"][number];
export type ActionId = FigureActionId | NpcActionId;

/** Rarity tier index 0–4 (Common … Legendary) → influence power in basis points. */
export const RARITY_POWER_BPS = [10000, 12500, 15000, 20000, 30000] as const;
export const RARITY_LABELS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;

export const RANKED_WORLD_VERSION = "alexandria-ranked-1";
