import type { WorldPack } from "../../src/types.ts";
import type { DecisionScope } from "../../src/life-stages/types.ts";
import { LIFE_PHASES } from "./life-phases.ts";
import { MIN_PACK_AGE } from "../../chain/pack-count.ts";
import { tuning } from "../../src/demo/market-rules.ts";
import { availableYearlyFocuses, focusActivity } from "./yearly-focus.ts";
import { PLANTING_HINT_AGE } from "./tutorial-triggers.ts";
import { YEARLY_ACTION_AGE } from "./year-reminder.ts";

/**
 * The roadmap of a life for the How to Play: five long stages, what opens during each and what to do there. The
 * unlock ages are read from the world (its decision stages, actions, jobs and market), so they stay true.
 */

export interface RoadmapUnlock { age: number; icon: string; text: string }
export type RoadmapState = "past" | "current" | "future";
export interface RoadmapStage {
  id: string;
  title: string;
  fromAge: number;
  /** The last age of the stage; null for the final stage. */
  toAge: number | null;
  unlocks: RoadmapUnlock[];
  /** One line: what a player should do in this stage. */
  todo: string;
  state: RoadmapState;
}

const WORK_PREFIX = "Work: ";

const SCOPE_TEXT: Record<DecisionScope, string> = {
  personal: "You make your own small choices",
  work: "You decide about work",
  community: "You decide in town matters",
  household: "You decide for the household",
};

function joinNames(names: readonly string[], max = 2): string {
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max} more` : shown;
}

/** Every unlock the world defines, by age. */
export function worldUnlocks(world: WorldPack): RoadmapUnlock[] {
  const unlocks: RoadmapUnlock[] = [];
  const activities = world.character?.activities ?? [];
  if (world.demo) unlocks.push({ age: PLANTING_HINT_AGE, icon: "res-grain", text: "Plan the household's fields" });
  if (activities.length) unlocks.push({ age: YEARLY_ACTION_AGE, icon: "check", text: "One yearly action: people, training or work" });
  const focusesByAge = new Map<number, string[]>();
  for (const focus of availableYearlyFocuses(world)) {
    const activity = focus.activityId ? focusActivity(world, focus.id) : undefined;
    if (!activity) continue;
    const age = activity.minAge ?? 0;
    focusesByAge.set(age, [...(focusesByAge.get(age) ?? []), focus.label]);
  }
  for (const [age, labels] of focusesByAge) unlocks.push({ age, icon: "literacy", text: `Focus: ${joinNames(labels, 3)}` });
  const tradeAge = world.demo ? tuning(world.demo.market).minTradeAge : undefined;
  if (tradeAge !== undefined) unlocks.push({ age: tradeAge, icon: "commerce", text: "Trade at the market once a year" });
  for (const job of world.character?.jobs ?? []) unlocks.push({ age: job.minAge ?? 0, icon: "craft", text: `${WORK_PREFIX}${job.title}` });
  const courtship = activities.filter(activity => activity.id.startsWith("court-")).map(activity => activity.minAge ?? 0);
  if (courtship.length) unlocks.push({ age: Math.min(...courtship), icon: "heart", text: "Courtship and marriage" });
  const family = activities.find(activity => activity.id === "grow-household");
  if (family) unlocks.push({ age: family.minAge ?? 0, icon: "people", text: "Start a family" });
  unlocks.push({ age: MIN_PACK_AGE, icon: "sun", text: `Reach ${MIN_PACK_AGE} to earn a card pack` });
  return unlocks.sort((a, b) => a.age - b.age);
}

/** All the jobs that open within one stage read as one line: the first few titles and how many more. */
function mergeWork(unlocks: readonly RoadmapUnlock[]): RoadmapUnlock[] {
  const work = unlocks.filter(unlock => unlock.text.startsWith(WORK_PREFIX));
  if (work.length === 0) return [...unlocks];
  const titles = work.map(unlock => unlock.text.slice(WORK_PREFIX.length));
  const merged = { age: work[0].age, icon: "craft", text: `${WORK_PREFIX}${joinNames(titles)}` };
  const rest = unlocks.filter(unlock => !unlock.text.startsWith(WORK_PREFIX));
  return [...rest.filter(unlock => unlock.age <= merged.age), merged, ...rest.filter(unlock => unlock.age > merged.age)];
}

/** The ages at which the world hands each kind of decision to the player (its finer stages and their scopes). */
function decisionUnlocks(world: WorldPack): RoadmapUnlock[] {
  const stages = world.lifeStages?.stages ?? [];
  const scopes = world.lifeStages?.scopes;
  if (!scopes) return [];
  return (Object.entries(scopes) as [DecisionScope, string][]).flatMap(([scope, id]) => {
    const stage = stages.find(candidate => candidate.id === id);
    return stage ? [{ age: stage.minAge, icon: "pin", text: SCOPE_TEXT[scope] }] : [];
  });
}

/** The five stages of a life with their unlocks; `age` marks where the current life is (null before a life begins). */
export function lifeRoadmap(world: WorldPack, age: number | null): RoadmapStage[] {
  const unlocks = [...decisionUnlocks(world), ...worldUnlocks(world)].sort((a, b) => a.age - b.age);
  return LIFE_PHASES.map(phase => {
    const inStage = (at: number) => at >= phase.fromAge && (phase.toAge === null || at <= phase.toAge);
    const state: RoadmapState = age === null ? "future" : inStage(age) ? "current" : age > (phase.toAge ?? Infinity) ? "past" : "future";
    return { id: phase.id, title: phase.title, fromAge: phase.fromAge, toAge: phase.toAge, unlocks: mergeWork(unlocks.filter(unlock => inStage(unlock.age))), todo: phase.todo, state };
  });
}

/** "Ages 6–12", "Age 60+". */
export function stageAges(stage: Pick<RoadmapStage, "fromAge" | "toAge">): string {
  if (stage.toAge === null) return `Age ${stage.fromAge}+`;
  return stage.toAge === stage.fromAge ? `Age ${stage.fromAge}` : `Ages ${stage.fromAge}–${stage.toAge}`;
}
