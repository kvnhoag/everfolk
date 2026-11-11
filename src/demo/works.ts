/** Track E — community works and district reputation. */
import type { DemoContext, DemoDefinition, DemoEffect, DemoState, LifeStateWithDemo, WorkId } from "./contracts.ts";
import { WORKS } from "./types.ts";

export function initialWorks(): DemoState["works"] {
  return Object.fromEntries(WORKS.map(work => [work, 0])) as DemoState["works"];
}
export function isBuilt(demo: DemoState, work: WorkId): boolean {
  return demo.built.includes(work);
}
/** Bounded change with a journal line naming the reason. */
export function changeReputation(ctx: DemoContext, delta: number, reason: string): void { void ctx; void delta; void reason; }
export function applyWork(ctx: DemoContext, effect: Extract<DemoEffect, { kind: "work" }>): void { void ctx; void effect; }
/** Spoilage reduction from a built village granary, basis points. */
export function spoilageCutBps(def: DemoDefinition, demo: DemoState): number { void def; void demo; return 0; }

export interface WorksView { reputation: number; works: { id: WorkId; title: string; progress: number; needed: number; built: boolean; cash: number; grain: number }[] }
export function worksView(def: DemoDefinition, life: LifeStateWithDemo): WorksView {
  return { reputation: life.demo.reputation, works: WORKS.map(id => ({ id, title: def.works.works[id].title, progress: life.demo.works[id],
    needed: def.works.works[id].progress, built: isBuilt(life.demo, id), cash: def.works.works[id].cash, grain: def.works.works[id].grain })) };
}
