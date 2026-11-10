import type { Effect, KnowledgeState, LifeState, WorldPack } from "./types.ts";

/** Omitted rules preserve the state shape and exact replay of earlier worlds. */
export function initialKnowledge(world: WorldPack): KnowledgeState | undefined {
  return world.knowledge ? { lastPracticeAge: null } : undefined;
}

/** Only accepted learning effects count. A capped stat still represents practice. */
export function recordKnowledgePractice(world: WorldPack, state: LifeState, effect: Effect): void {
  if (!world.knowledge || state.phase === "ended") return;
  const learns = effect.type === "stat" && effect.stat === world.knowledge.stat && Number.isFinite(effect.delta) && effect.delta > 0 ||
    effect.type === "mastery" && effect.target === "stat" && effect.id === world.knowledge.stat;
  if (!learns) return;
  state.knowledge ??= initialKnowledge(world)!;
  state.knowledge.lastPracticeAge = state.age;
}

/** Resolve one completed-age interval. The engine calls this once per advance. */
export function progressKnowledge(world: WorldPack, state: LifeState, journal: (id: string, text: string) => void): void {
  if (!world.knowledge || state.phase === "ended") return;
  const model = world.knowledge;
  const record = state.knowledge ??= initialKnowledge(world)!;
  const baseline = Math.max(record.lastPracticeAge ?? model.minAge, model.minAge);
  const idleLoss = state.age >= model.minAge && record.lastPracticeAge !== state.age && state.age - baseline >= model.idleGraceYears ? model.idleLoss : 0;
  const ageLoss = model.ageBands.find(band => state.age >= band.minAge && state.age <= band.maxAge)?.loss ?? 0;
  const stat = world.stats[model.stat];
  const before = state.stats[model.stat];
  const next = Math.max(stat.min, Math.min(stat.max, before - idleLoss - ageLoss));
  const loss = before - next;
  if (loss <= 0) return;
  state.stats[model.stat] = next;
  // Round insignificant binary residue for readable journal amounts without
  // changing the actual simulation value or using locale-dependent formatting.
  const amount = Number(loss.toPrecision(12));
  const label = stat.label;
  if (idleLoss > 0 && ageLoss > 0) {
    journal("knowledge-combined-decline", `You have not kept up with learning, and age is affecting your recall. ${label} falls by ${amount}.`);
  } else if (idleLoss > 0) {
    journal("knowledge-idle-decline", `You have not kept up with learning. ${label} falls by ${amount}.`);
  } else {
    journal("knowledge-age-decline", `Recall becomes harder with age. ${label} falls by ${amount}.`);
  }
}
