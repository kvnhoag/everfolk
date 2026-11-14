import type { LifeState, WorldPack } from "../../src/types.ts";
import { sectionAges, sectionFacts, sectionOpenAge, visibleSections, type GameSection } from "./onboarding-sections.ts";
import { YEAR_TASKS, YEARLY_ACTION_AGE, yearTask, type YearTask, type YearTaskFacts } from "./year-reminder.ts";

/**
 * Reads the yearly reminder's facts from a life, so the notice in the game and Next decision's stop rule agree on what
 * the player still has to try. Pure.
 */

const TASK_SECTION: Record<YearTask, GameSection> = { focus: "focus", action: "yearly-action", market: "deck-market", planting: "planting" };

export interface GuideInput {
  life: LifeState;
  world: WorldPack;
  /** The player picked a focus other than Everyday life. */
  focusChosen: boolean;
  /** This year's market visit is spent. */
  visitUsed: boolean;
  /** Tips are on: a step's tip introduces it the year it opens. */
  tipsOn: boolean;
  /** Steps an earlier year's notice pointed at. */
  pointed: readonly YearTask[];
  planProblem?: boolean;
  overfull?: boolean;
  ongoing?: readonly YearTask[];
}

/** The steps this life has used at least once. */
export function learnedTasks(life: LifeState, focusChosen: boolean): YearTask[] {
  const used: Record<YearTask, boolean> = {
    focus: focusChosen,
    action: life.journal.some(entry => entry.type === "activity" && entry.age >= YEARLY_ACTION_AGE),
    market: life.commands.some(command => command.type === "trade"),
    planting: life.commands.some(command => command.type === "plan"),
  };
  return YEAR_TASKS.filter(task => used[task]);
}

/** The steps on screen that the player can still use this year. */
export function openTasks(life: LifeState, sections: ReadonlySet<GameSection>, visitUsed: boolean): YearTask[] {
  const usable: Record<YearTask, boolean> = {
    focus: true,
    action: life.character?.lastActivityAge !== life.age,
    market: !visitUsed,
    planting: true,
  };
  return YEAR_TASKS.filter(task => sections.has(TASK_SECTION[task]) && usable[task]);
}

export function yearGuideFacts(input: GuideInput): YearTaskFacts {
  const { life, world } = input;
  const ages = sectionAges(world, life);
  const facts = sectionFacts(world, life);
  const sections = visibleSections(facts, ages);
  const introduced = input.tipsOn ? YEAR_TASKS.filter(task => sectionOpenAge(TASK_SECTION[task], ages, facts.economy) === life.age) : [];
  return {
    phase: life.phase, open: openTasks(life, sections, input.visitUsed), learned: learnedTasks(life, input.focusChosen),
    pointed: input.pointed, introduced, planProblem: input.planProblem ?? false, overfull: input.overfull ?? false, ongoing: input.ongoing ?? [],
  };
}

/** A step the player has not tried yet would be named this year: with tips on, Next decision stops here. */
export function guidePointerDue(input: GuideInput): boolean {
  return input.tipsOn && yearTask(yearGuideFacts({ ...input, planProblem: false, overfull: false }))?.reason === "learn";
}

/** Problems already named stay quiet only while they last; a solved one may be named again later. */
export function stillOngoing(ongoing: readonly YearTask[], now: { overfull: boolean; planProblem: boolean }): YearTask[] {
  return ongoing.filter(task => task === "market" ? now.overfull : task === "planting" ? now.planProblem : false);
}
