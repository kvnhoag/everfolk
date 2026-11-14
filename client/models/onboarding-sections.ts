import type { LifeState, WorldPack } from "../../src/types.ts";
import { tuning } from "../../src/demo/market-rules.ts";
import type { TutorialHintId } from "./tutorial-hints.ts";
import { PLANTING_HINT_AGE } from "./tutorial-triggers.ts";
import { YEARLY_ACTION_AGE } from "./year-reminder.ts";
import { yearlyFocusFirstAge } from "./yearly-focus.ts";

/**
 * Which parts of the life screen are drawn at each age. A section stays hidden (not greyed out, not a lock) until the
 * first age the player can act on it, so a new player only ever sees what they can use. Pure, so the whole map is
 * tested, and the tutorial, the yearly reminder and Next decision all read the same answer.
 */

/** In screen order. "decisions" and "skill-tree" open on events (the first turning point, the first skill). */
export const GAME_SECTIONS = [
  "time-bar", "story", "rail", "decisions",
  "checklist", "focus", "yearly-action", "wealth", "skill-tree",
  "resources", "inventory", "command-deck", "deck-market", "deck-career", "deck-people", "character", "spend",
  "conditions", "planting", "deck-farm", "deck-works",
] as const;
export type GameSection = typeof GAME_SECTIONS[number];

/** The ages that open the life's sections, read from the world. */
export interface SectionAges {
  /** The first yearly focus; Infinity when the world has none. */
  focus: number;
  action: number;
  /** The grain market; null when the world has no market. */
  trade: number | null;
  /** The youngest job; Infinity when the world has none. */
  firstJob: number;
  /** The household's fields become the player's to plan. */
  fields: number;
}

/** What the life shows now. */
export interface SectionFacts {
  age: number;
  /** The household economy (resource bar, command deck) exists in this world. */
  economy: boolean;
  learnedSkills: number;
  /** A turning point is waiting now or was met earlier in this life. */
  hadDecision: boolean;
}

const NEVER = Infinity;

export function sectionAges(world: WorldPack, life: Pick<LifeState, "originId">): SectionAges {
  const jobAges = (world.character?.jobs ?? []).map(job => job.minAge ?? 0);
  return {
    focus: yearlyFocusFirstAge(world, life),
    action: YEARLY_ACTION_AGE,
    trade: world.demo ? tuning(world.demo.market).minTradeAge : null,
    firstJob: jobAges.length ? Math.min(...jobAges) : NEVER,
    fields: PLANTING_HINT_AGE,
  };
}

export function learnedSkillCount(life: Pick<LifeState, "capabilities" | "deepCapabilities">): number {
  return Object.keys(life.capabilities?.learned ?? {}).length + Object.keys(life.deepCapabilities?.learned ?? {}).length;
}

export function sectionFacts(world: WorldPack, life: LifeState): SectionFacts {
  return {
    age: life.age,
    economy: Boolean(world.demo && life.demo),
    learnedSkills: learnedSkillCount(life),
    hadDecision: life.phase === "choice" || life.journal.some(entry => entry.type === "choice"),
  };
}

/** The household's market opens with trading; without a market, with the fields. */
function householdAge(ages: SectionAges): number {
  return ages.trade ?? ages.fields;
}

/** The age a section opens, or null for sections that open on an event. Infinity: never in this world. */
export function sectionOpenAge(id: GameSection, ages: SectionAges, economy = true): number | null {
  const household = (age: number) => economy ? age : NEVER;
  switch (id) {
    case "time-bar": case "story": case "rail": return 0;
    case "decisions": case "skill-tree": return null;
    case "checklist": return Math.min(ages.focus, ages.action);
    case "focus": return ages.focus;
    case "yearly-action": case "wealth": return ages.action;
    case "resources": case "inventory": case "deck-people": return household(householdAge(ages));
    case "command-deck": return household(Math.min(householdAge(ages), ages.firstJob));
    case "deck-market": return household(ages.trade ?? NEVER);
    case "deck-career": return household(ages.firstJob);
    case "character": case "spend": return Math.min(ages.firstJob, ages.trade ?? NEVER);
    case "conditions": case "planting": case "deck-farm": case "deck-works": return household(ages.fields);
  }
}

function sectionOpen(id: GameSection, facts: SectionFacts, ages: SectionAges): boolean {
  if (id === "decisions") return facts.hadDecision;
  if (id === "skill-tree") return facts.learnedSkills > 0;
  return facts.age >= (sectionOpenAge(id, ages, facts.economy) ?? NEVER);
}

/** The sections drawn now, in screen order. */
export function visibleSections(facts: SectionFacts, ages: SectionAges): ReadonlySet<GameSection> {
  return new Set(GAME_SECTIONS.filter(id => sectionOpen(id, facts, ages)));
}

/** A tip that introduces a section the first time it appears; `covers` lists every section it explains. */
export interface SectionTip {
  hint: TutorialHintId;
  /** The section the tip points at. */
  section: GameSection;
  covers: readonly GameSection[];
  /** The tip waits until this age even though its section is drawn earlier. */
  fromAge?: number;
}

/** The early years teach one thing at a time, in this order. */
export const SECTION_TIPS: readonly SectionTip[] = [
  { hint: "time-bar", section: "time-bar", covers: ["time-bar", "rail"] },
  { hint: "scene", section: "story", covers: ["story"], fromAge: 1 },
  { hint: "decision", section: "decisions", covers: ["decisions"] },
  { hint: "focus", section: "focus", covers: ["focus", "checklist"] },
  { hint: "yearly-action", section: "yearly-action", covers: ["yearly-action"] },
  { hint: "wealth", section: "wealth", covers: ["wealth"] },
  { hint: "skills", section: "skill-tree", covers: ["skill-tree"] },
  { hint: "resources", section: "resources", covers: ["resources", "inventory"] },
  { hint: "market", section: "deck-market", covers: ["deck-market", "command-deck", "deck-career", "deck-people"] },
  { hint: "character", section: "character", covers: ["character", "spend"] },
  { hint: "planting", section: "planting", covers: ["planting", "conditions", "deck-farm", "deck-works"] },
];

/**
 * The first unseen tip for a section that opened between two moments, or null. Next decision stops there while tips
 * are on, so skipping years never skips the first try of something new.
 */
export function newGuidedStep(before: ReadonlySet<GameSection>, after: ReadonlySet<GameSection>, seen: readonly string[]): TutorialHintId | null {
  const opened = (id: GameSection) => after.has(id) && !before.has(id);
  return SECTION_TIPS.find(tip => !seen.includes(tip.hint) && tip.covers.some(opened))?.hint ?? null;
}

/**
 * Tips whose stage passed before this year, for a save opened mid-life: they count as seen, so a loaded life shows its
 * current sections without replaying old tips. Event sections already open count as passed.
 */
export function tipsPassedOnEntry(facts: SectionFacts, ages: SectionAges): TutorialHintId[] {
  if (facts.age <= 0) return [];
  const visible = visibleSections(facts, ages);
  return SECTION_TIPS.filter(tip => {
    if (!visible.has(tip.section)) return false;
    const open = sectionOpenAge(tip.section, ages, facts.economy);
    return open === null || Math.max(open, tip.fromAge ?? 0) < facts.age;
  }).map(tip => tip.hint);
}
