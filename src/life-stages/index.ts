/** Life stages, event time frames and who decides. Pure; no randomness of its own. */
import type { LifeEvent, WorldPack } from "../types.ts";
import { DECISION_SCOPES } from "./types.ts";
import type { DecisionScope, LifeStage, LifeStageView } from "./types.ts";

export * from "./types.ts";

export function lifeStageAt(world: Pick<WorldPack, "lifeStages">, age: number): LifeStage | undefined {
  const stages = world.lifeStages?.stages;
  if (!stages) return undefined;
  let current: LifeStage | undefined;
  for (const stage of stages) if (age >= stage.minAge) current = stage;
  return current;
}

function stageIndex(world: Pick<WorldPack, "lifeStages">, id: string): number {
  return world.lifeStages!.stages.findIndex(stage => stage.id === id);
}

/** Whether the player at this age decides events of the scope. Unstaged worlds: always. */
export function decidesScope(world: Pick<WorldPack, "lifeStages">, scope: DecisionScope, age: number): boolean {
  const current = lifeStageAt(world, age);
  if (!current) return true;
  return stageIndex(world, current.id) >= stageIndex(world, world.lifeStages!.scopes[scope]);
}

/** Whether the event's time frame includes this age. Events without stages have no limit. */
export function inTimeFrame(world: Pick<WorldPack, "lifeStages">, event: LifeEvent, age: number): boolean {
  if (!world.lifeStages || !event.stages) return true;
  const current = lifeStageAt(world, age);
  return current !== undefined && event.stages.includes(current.id);
}

/** A decision event the player may not decide now: others resolve it, or it does not happen. */
export function decidedByOthers(world: Pick<WorldPack, "lifeStages">, event: LifeEvent, age: number): boolean {
  return Boolean(world.lifeStages) && event.mode !== "automatic" && !decidesScope(world, event.scope ?? "personal", age);
}

/** Read-only view for screens: the current stage and the scopes the player decides. */
export function lifeStageView(world: Pick<WorldPack, "lifeStages">, age: number): LifeStageView | undefined {
  const current = lifeStageAt(world, age);
  if (!current) return undefined;
  return { id: current.id, title: current.title, decides: DECISION_SCOPES.filter(scope => decidesScope(world, scope, age)) };
}
