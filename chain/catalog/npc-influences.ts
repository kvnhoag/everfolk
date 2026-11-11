import type { InfluenceEntry } from "./influence-entry.ts";
import { flag, skill, stat } from "./content.ts";

/**
 * NPC actions are applied at a key decision. Stat and skill deltas (like cash and
 * debt) scale with the source's rarity power, rounded toward zero; flag effects
 * apply as written.
 * Base weight 3 marks the larger action in a menu, 1 the smaller one.
 */
export const NPC_INFLUENCES: readonly InfluenceEntry[] = [
  {
    id: "letters.teach",
    label: "A teacher took you in hand for a season and drilled your letters.",
    baseWeight: 3,
    effects: [stat("knowledge", 4), stat("bonds", 1), skill("literacy", 3)],
  },
  {
    id: "letters.lend-books",
    label: "A reader lent you a book roll and talked it over with you.",
    baseWeight: 1,
    effects: [stat("knowledge", 2), skill("literacy", 1), skill("philosophy", 1)],
  },
  {
    id: "military.mentor",
    label: "A veteran took you under his wing and taught you to keep your footing.",
    baseWeight: 3,
    effects: [stat("health", 3), stat("bonds", 2), skill("warfare", 3)],
  },
  {
    id: "military.warn-levy",
    label: "A soldier warned you that the recruiters were coming, so you put food and silver aside.",
    baseWeight: 1,
    effects: [stat("health", 2), stat("wealth", 1)],
  },
  {
    id: "commerce.credit",
    label: "A merchant extended you credit on easy terms when you needed it.",
    baseWeight: 3,
    effects: [stat("wealth", 4), stat("bonds", 1)],
  },
  {
    id: "commerce.hire",
    label: "A trader hired you for a season of paid work at the quays.",
    baseWeight: 1,
    effects: [stat("wealth", 2), skill("reckoning", 1)],
  },
  {
    id: "craft.apprentice",
    label: "A workshop master took you on and taught you the trade's first skills.",
    baseWeight: 3,
    effects: [stat("knowledge", 2), stat("wealth", 1), skill("craft", 4), flag("apprenticed")],
  },
  {
    id: "craft.commission",
    label: "A craftsman shared part of a paid commission with you.",
    baseWeight: 1,
    effects: [stat("wealth", 2), stat("bonds", 1), skill("craft", 1)],
  },
  {
    id: "sky.omen",
    label: "An interpreter of the sky read a favourable omen for you.",
    baseWeight: 1,
    effects: [stat("bonds", 2), stat("health", 1)],
  },
  {
    id: "sky.warn-year",
    label: "A sky-watcher warned of a hard year, and your household stored food against it.",
    baseWeight: 3,
    effects: [stat("health", 4), stat("bonds", 1)],
  },
  {
    id: "performance.lift",
    label: "A musician's playing lifted your spirits through a hard week.",
    baseWeight: 1,
    effects: [stat("health", 2), stat("bonds", 2)],
  },
  {
    id: "performance.lend-hand",
    label: "A troupe of performers lent your household a hand when it was struggling.",
    baseWeight: 3,
    effects: [stat("health", 2), stat("bonds", 3), stat("wealth", 2)],
  },
];
