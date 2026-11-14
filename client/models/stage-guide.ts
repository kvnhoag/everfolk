import type { WorldPack } from "../../src/types.ts";
import type { RoadmapStage, RoadmapUnlock } from "./life-roadmap.ts";
import { stageAges } from "./life-roadmap.ts";

/**
 * One life stage, opened from the road in How to Play: your role, what opens, the kinds of yearly actions with real
 * examples, the jobs, and turning points the world places at those ages with their actual choices. Read from the
 * world, so it stays true when content changes. Pure.
 */

export interface ActionGroup { id: string; label: string; icon: string; count: number; examples: string[] }
export interface TurningPointExample { title: string; age: number; choices: string[] }

export interface StageGuide {
  id: string;
  title: string;
  ages: string;
  role: string;
  unlocks: RoadmapUnlock[];
  actions: ActionGroup[];
  jobs: { count: number; examples: string[] };
  turningPoints: { count: number; examples: TurningPointExample[] };
}

const CATEGORIES: readonly { id: string; label: string; icon: string }[] = [
  { id: "training", label: "Training", icon: "literacy" },
  { id: "career", label: "Work", icon: "craft" },
  { id: "relationship", label: "People", icon: "heart" },
  { id: "family", label: "Family", icon: "people" },
  { id: "finance", label: "Money", icon: "res-drachmas" },
];

const EXAMPLES = 3;
const TURNING_POINT_EXAMPLES = 3;

function inStage(stage: Pick<RoadmapStage, "fromAge" | "toAge">, age: number): boolean {
  return age >= stage.fromAge && (stage.toAge === null || age <= stage.toAge);
}

/** Drops a trailing price note ("— 10 drachmas") so an example reads as a plain action. */
function plain(text: string): string {
  return text.replace(/\s+[—-]\s+\d+\s+(?:drachmas|dr)\.?$/i, "").trim();
}

function unique(texts: readonly string[]): string[] {
  return [...new Set(texts)];
}

export function stageGuide(world: WorldPack, stage: RoadmapStage): StageGuide {
  const activities = (world.character?.activities ?? []).filter(activity => inStage(stage, activity.minAge ?? 0));
  const actions = CATEGORIES.map(category => {
    const texts = unique(activities.filter(activity => activity.category === category.id).map(activity => plain(activity.text)));
    return { ...category, count: texts.length, examples: texts.slice(0, EXAMPLES) };
  }).filter(group => group.count > 0);
  const jobs = unique((world.character?.jobs ?? []).filter(job => inStage(stage, job.minAge ?? 0)).map(job => job.title));
  const events = (world.events ?? [])
    .filter(event => event.trigger?.type === "age" && inStage(stage, event.trigger.at))
    .sort((a, b) => (a.trigger.type === "age" ? a.trigger.at : 0) - (b.trigger.type === "age" ? b.trigger.at : 0));
  const withChoices = events.filter(event => (event.choices?.length ?? 0) > 1);
  const examples = withChoices.slice(0, TURNING_POINT_EXAMPLES).map(event => ({
    title: event.title, age: event.trigger.type === "age" ? event.trigger.at : stage.fromAge, choices: event.choices.map(choice => choice.text),
  }));
  return {
    id: stage.id, title: stage.title, ages: stageAges(stage), role: stage.todo, unlocks: stage.unlocks,
    actions, jobs: { count: jobs.length, examples: jobs.slice(0, 4) }, turningPoints: { count: events.length, examples },
  };
}
