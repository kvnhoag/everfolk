import type { WorldPack } from "../../src/types.ts";
import type { DecisionScope, LifeStage } from "../../src/life-stages/types.ts";
import { MIN_PACK_AGE } from "../../chain/pack-count.ts";
import { tuning } from "../../src/demo/market-rules.ts";
import { availableYearlyFocuses, focusActivity } from "./yearly-focus.ts";
import { PLANTING_HINT_AGE } from "./tutorial-triggers.ts";
import { YEARLY_ACTION_AGE } from "./year-reminder.ts";

/**
 * The roadmap of a life for the How to Play: each life stage, what opens during it and what to do there.
 * Read from the world's own stages and unlock ages, so it stays true when content changes.
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

/** Stages for worlds that do not define their own. */
const DEFAULT_STAGES: readonly LifeStage[] = [
  { id: "infancy", title: "Infancy", minAge: 0 },
  { id: "early-childhood", title: "Early childhood", minAge: 3 },
  { id: "childhood", title: "Childhood", minAge: 6 },
  { id: "adolescence", title: "Adolescence", minAge: 12 },
  { id: "adulthood", title: "Adulthood", minAge: 16 },
  { id: "later-life", title: "Later life", minAge: 60 },
];

const TODO: Record<string, string> = {
  "infancy": "Your family decides for you. Press Resume and let the first years pass.",
  "early-childhood": "Make your first small choices. Open Inventory & Granary to plan the family fields.",
  "childhood": "Pick a focus (Study is a good start) and spend your yearly action every year.",
  "adolescence": "Take your first work and practise the trade you want to grow up into.",
  "youth": "Train toward a career; town decisions are yours now.",
  "adulthood": "Work, court, marry and build your household. Reaching 18 earns a card pack.",
  "later-life": "Health fades with age: rest, care for family and secure your legacy.",
};
const WORK_PREFIX = "Work: ";
const FALLBACK_TODO = "Keep a focus, spend your yearly action and answer turning points.";

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
  if (world.demo) unlocks.push({ age: PLANTING_HINT_AGE, icon: "res-grain", text: "Start planning the family fields" });
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

/** The stages of a life with their unlocks; `age` marks where the current life is (null before a life begins). */
export function lifeRoadmap(world: WorldPack, age: number | null): RoadmapStage[] {
  const stages = world.lifeStages?.stages.length ? world.lifeStages.stages : DEFAULT_STAGES;
  const scopes = world.lifeStages?.scopes;
  const unlocks = worldUnlocks(world);
  return stages.map((stage, index) => {
    const next = stages[index + 1];
    const toAge = next ? next.minAge - 1 : null;
    const inStage = (at: number) => at >= stage.minAge && (toAge === null || at <= toAge);
    const decides = scopes ? (Object.entries(scopes) as [DecisionScope, string][]).filter(([, id]) => id === stage.id)
      .map(([scope]) => ({ age: stage.minAge, icon: "pin", text: SCOPE_TEXT[scope] })) : [];
    const state: RoadmapState = age === null ? "future" : inStage(age) ? "current" : age > (toAge ?? Infinity) ? "past" : "future";
    return { id: stage.id, title: stage.title, fromAge: stage.minAge, toAge, unlocks: [...decides, ...mergeWork(unlocks.filter(unlock => inStage(unlock.age)))],
      todo: TODO[stage.id] ?? FALLBACK_TODO, state };
  });
}

/** "Ages 6–11", "Age 60+". */
export function stageAges(stage: Pick<RoadmapStage, "fromAge" | "toAge">): string {
  if (stage.toAge === null) return `Age ${stage.fromAge}+`;
  return stage.toAge === stage.fromAge ? `Age ${stage.fromAge}` : `Ages ${stage.fromAge}–${stage.toAge}`;
}
