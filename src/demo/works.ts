/** Track E — community works and district reputation. */
import type { Effect } from "../types.ts";
import type { DemoContext, DemoDefinition, DemoEffect, DemoState, LifeStateWithDemo, WorkId } from "./contracts.ts";
import { WORKS } from "./types.ts";

export function initialWorks(): DemoState["works"] {
  return Object.fromEntries(WORKS.map(work => [work, 0])) as DemoState["works"];
}
export function isBuilt(demo: DemoState, work: WorkId): boolean {
  return demo.built.includes(work);
}

/** Cash and grain paid for one yearly build activity: the work's total split evenly over its progress, rounded. */
export function workUseCost(def: Pick<DemoDefinition, "works">, work: WorkId): { cash: number; grain: number } {
  const config = def.works.works[work];
  return { cash: Math.round(config.cash / config.progress), grain: Math.round(config.grain / config.progress) };
}

/** Bounded change with a journal line naming the reason. Nothing is written when the value does not move. */
export function changeReputation(ctx: DemoContext, delta: number, reason: string): void {
  if (!Number.isSafeInteger(delta)) throw new Error("Reputation changes must be whole numbers.");
  const { min, max } = ctx.def.works.reputation;
  const before = ctx.demo.reputation;
  const after = Math.min(max, Math.max(min, before + delta));
  if (after === before) return;
  ctx.demo.reputation = after;
  ctx.journal("reputation-change", `Your standing in the district ${after > before ? "rises" : "falls"} to ${after} (${reason}).`);
}

function completionEffects(ctx: DemoContext, work: WorkId): Effect[] {
  const stats = ctx.def.works.completionStats?.[work] ?? {};
  return Object.entries(stats).filter(([stat, delta]) => delta !== 0 && stat in ctx.world.stats)
    .map(([stat, delta]) => ({ type: "stat", stat, delta }));
}

/** Adds progress; on reaching the work's size it is built once, raises reputation and gives its one-off effect. */
export function applyWork(ctx: DemoContext, effect: Extract<DemoEffect, { kind: "work" }>): void {
  const { work } = effect;
  if (isBuilt(ctx.demo, work)) return;
  if (!Number.isSafeInteger(effect.progress) || effect.progress < 1) throw new Error("Work progress must be a positive whole number.");
  const config = ctx.def.works.works[work];
  const progress = Math.min(config.progress, ctx.demo.works[work] + effect.progress);
  ctx.demo.works = { ...ctx.demo.works, [work]: progress };
  if (progress < config.progress) {
    ctx.journal(`work-${work}-progress`, `${config.title}: ${progress} of ${config.progress} seasons of work are done.`);
    return;
  }
  ctx.demo.built = [...ctx.demo.built, work];
  ctx.journal(`work-${work}-built`, `${config.title} is finished. The district will remember who paid for it.`);
  changeReputation(ctx, config.reputation, `you finished ${config.title.toLowerCase()}`);
  const effects = completionEffects(ctx, work);
  if (effects.length) ctx.apply(effects);
}

function bonusIfBuilt(demo: DemoState, work: WorkId, bps: number | undefined): number {
  return isBuilt(demo, work) ? bps ?? 0 : 0;
}

/** Spoilage reduction from a built village granary, basis points (Track A applies it to household spoilage). */
export function spoilageCutBps(def: DemoDefinition, demo: DemoState): number {
  return bonusIfBuilt(demo, "granary", def.works.granarySpoilageCutBps);
}
/** Discount on paid learning once the village school is built, basis points (lead/Track A: apply to learning costs). */
export function learningDiscountBps(def: DemoDefinition, demo: DemoState): number {
  return bonusIfBuilt(demo, "school", def.works.schoolDiscountBps);
}
/** Cut in the yearly illness chance once the village well is built, basis points (lead: scale health incidence). */
export function illnessReliefBps(def: DemoDefinition, demo: DemoState): number {
  return bonusIfBuilt(demo, "well", def.works.wellIllnessReliefBps);
}
/** Extra recovery from illness once the healing house is built, basis points (lead: scale health recovery). */
export function recoveryBonusBps(def: DemoDefinition, demo: DemoState): number {
  return bonusIfBuilt(demo, "healing-house", def.works.healingRecoveryBonusBps);
}

export interface WorksView {
  reputation: number;
  works: { id: WorkId; title: string; progress: number; needed: number; built: boolean; cash: number; grain: number; useCash: number; useGrain: number }[];
}
/** Read-only: never mutates the life and never draws randomness. */
export function worksView(def: DemoDefinition, life: LifeStateWithDemo): WorksView {
  return { reputation: life.demo.reputation, works: WORKS.map(id => {
    const config = def.works.works[id], use = workUseCost(def, id);
    return { id, title: config.title, progress: life.demo.works[id], needed: config.progress, built: isBuilt(life.demo, id),
      cash: config.cash, grain: config.grain, useCash: use.cash, useGrain: use.grain };
  }) };
}
