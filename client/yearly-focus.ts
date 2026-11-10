import type { ActivityAvailability, Choice, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { getOutcomeProbabilities } from "../src/outcomes.ts";
import { severeHealthRisk } from "./health-risk.ts";
import { readEverfolkStorage } from "./brand-storage.ts";

export const YEARLY_FOCUSES = [
  { id: "everyday", label: "Everyday life", activityId: null },
  { id: "study", label: "Study", activityId: "train-literacy" },
  { id: "craft", label: "Woodwork", activityId: "train-craft" },
  { id: "pottery", label: "Pottery", activityId: "train-pottery" },
  { id: "carving", label: "Wood carving", activityId: "train-carving" },
  { id: "sculpture", label: "Stone sculpture", activityId: "train-sculpture" },
  { id: "friends", label: "Friends", activityId: "visit-a-friend" },
  { id: "health", label: "Health", activityId: "take-an-easy-walk" },
] as const;

export type YearlyFocusId = typeof YEARLY_FOCUSES[number]["id"];
export interface FocusStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function normalizeYearlyFocus(value: unknown, world?: WorldPack): YearlyFocusId {
  const focus = YEARLY_FOCUSES.find(focus => focus.id === value);
  if (!focus) return "everyday";
  if (focus.activityId && world && !world.character?.activities.some(activity => activity.id === focus.activityId)) return "everyday";
  return focus.id;
}

/** Focus is a device preference for exactly one life, not part of its simulation. */
export function yearlyFocusStorageKey(life: Pick<LifeState, "worldFingerprint" | "seed">): string {
  return `everfolk:yearly-focus:v1:${life.worldFingerprint}:${encodeURIComponent(life.seed)}`;
}

export function readYearlyFocus(storage: FocusStorage, life: LifeState, world?: WorldPack): YearlyFocusId {
  try { return normalizeYearlyFocus(readEverfolkStorage(storage, yearlyFocusStorageKey(life)), world); }
  catch { return "everyday"; }
}

export function persistYearlyFocus(storage: FocusStorage, life: LifeState, focusId: YearlyFocusId): void {
  storage.setItem(yearlyFocusStorageKey(life), normalizeYearlyFocus(focusId));
}

export function focusActivity(world: WorldPack, focusId: YearlyFocusId) {
  const id = YEARLY_FOCUSES.find(focus => focus.id === focusId)?.activityId;
  return id ? world.character?.activities.find(activity => activity.id === id) : undefined;
}

/** Authored base rules at the current age, not a prediction of the net outcome. */
export function yearlyDeclineNotes(life: LifeState, world: WorldPack): string[] {
  if (life.phase === "ended") return [];
  const notes: string[] = [];
  const ageing: string[] = [];
  const healthLoss = world.health?.declineBands.find(band => life.age >= band.minAge && life.age <= band.maxAge)?.healthLoss ?? 0;
  if (healthLoss > 0) ageing.push(`${world.stats[world.health!.stat].label} ${healthLoss}`);
  const knowledge = world.knowledge;
  const knowledgeLoss = knowledge?.ageBands.find(band => life.age >= band.minAge && life.age <= band.maxAge)?.loss ?? 0;
  if (knowledgeLoss > 0) ageing.push(`${world.stats[knowledge!.stat].label} ${knowledgeLoss}`);
  if (ageing.length) notes.push(`Ageing per year: ${ageing.join(" · ")}.`);
  if (knowledge && life.knowledge && life.age >= knowledge.minAge && knowledge.idleLoss > 0) {
    const label = world.stats[knowledge.stat].label;
    if (life.knowledge.lastPracticeAge === life.age) notes.push("Learning practised this year.");
    else notes.push(`${label} fades by ${knowledge.idleLoss}/year after ${knowledge.idleGraceYears} ${knowledge.idleGraceYears === 1 ? "year" : "years"} without learning.`);
  }
  return notes;
}

export function focusStatus(life: LifeState, world: WorldPack, focusId: YearlyFocusId, activities: readonly ActivityAvailability[]): string {
  if (life.phase === "ended") return "This life has ended.";
  if (life.phase === "choice") return "Choose an option to continue.";
  if (focusId === "everyday") return "No activity will be chosen for you.";
  const activity = focusActivity(world, focusId);
  if (!activity) return "This focus is unavailable in this world.";
  if (life.character?.lastActivityAge === life.age) return "You already chose an activity this year. Focus resumes next year.";
  const available = activities.find(candidate => candidate.id === activity.id);
  if (!available?.available) return `Skipped this year: ${available?.reason ?? "This activity is unavailable."}`;
  return "Repeats before the next year, when available. Uses your yearly activity.";
}

/** Both timed years and fast-forward accept the same normal engine commands. */
export function advanceYearWithFocus(engine: LifeEngine, life: LifeState, focusId: YearlyFocusId): LifeState {
  if (life.phase !== "ready") return life;
  let next = life;
  const activity = focusActivity(engine.world, normalizeYearlyFocus(focusId, engine.world));
  if (activity && life.character?.lastActivityAge !== life.age) {
    const available = engine.getActivities(life).find(candidate => candidate.id === activity.id);
    if (available?.available) next = engine.act(life, activity.id);
  }
  // An activity can itself end life or offer a due decision.
  return next.phase === "ready" ? engine.advance(next) : next;
}

export function advanceToDecisionWithFocus(engine: LifeEngine, life: LifeState, focusId: YearlyFocusId): LifeState {
  let next = life;
  for (let years = 0; years <= engine.world.maxAge; years++) {
    if (next.phase !== "ready") return next;
    next = advanceYearWithFocus(engine, next, focusId);
    // Fast-forward must stop where the repayment reminder can be seen.
    const loan = next.economy?.loan;
    if (loan && loan.balance > 0 && next.age >= loan.dueAge - 1) return next;
  }
  throw new Error("This life could not reach its next decision.");
}

/** Choose the lowest disclosed fatal risk, including a recorded severe episode. */
export function selectAutomaticChoice(choices: readonly Choice[], world?: WorldPack, life?: LifeState): Choice | undefined {
  let selected: Choice | undefined;
  let lowestRisk = Infinity;
  for (const choice of choices) {
    // A dangerous contract always needs the player's explicit acceptance.
    if (choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "loan" && effect.action === "borrow"))) continue;
    const branches = world && life ? getOutcomeProbabilities(world, life, choice)
      : choice.outcomes.map(outcome => ({ outcome, probability: outcome.weight / Math.max(...choice.outcomes.map(item => item.weight)) }));
    const total = branches.reduce((sum, branch) => sum + branch.probability, 0);
    const fatal = branches.reduce((sum, { outcome, probability }) => {
      const ends = outcome.effects.find(effect => effect.type === "end");
      const immediate = ends?.type === "end" && (!world || ends.deathCause || world.endings.find(ending => ending.id === ends.ending)?.kind !== "chapter");
      const later = !ends && world && life ? severeHealthRisk(life, world, { ...choice, outcomes: [outcome] })?.expected ?? 0 : 0;
      return sum + probability * (immediate ? 1 : later);
    }, 0);
    const risk = total > 0 ? fatal / total : 1;
    if (risk < lowestRisk) { selected = choice; lowestRisk = risk; }
  }
  return selected;
}
