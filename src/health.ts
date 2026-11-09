import type { ActiveHealthCondition, Condition, HealthConditionDefinition, HealthState, LifeState, WorldPack } from "./types.ts";

export interface HealthHooks {
  random: () => number;
  matches: (condition: Condition | undefined) => boolean;
  journal: (id: string, text: string) => void;
  /** Current household support, normalized by the relationship model. */
  support: number;
}

export interface HealthProgress { deathCause?: string; context?: string }

const unit = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function initialHealth(world: WorldPack): HealthState | undefined {
  return world.health ? { conditions: [], needsCareDecision: false } : undefined;
}

function definition(world: WorldPack, id: string): HealthConditionDefinition {
  const found = world.health?.conditions.find(condition => condition.id === id);
  if (!found) throw new Error(`Unknown health condition: ${id}`);
  return found;
}

function healthRecord(world: WorldPack, state: LifeState): HealthState | undefined {
  if (!world.health) return undefined;
  return state.health ??= initialHealth(world)!;
}

function changeHealth(world: WorldPack, state: LifeState, delta: number): void {
  const id = world.health!.stat;
  const stat = world.stats[id];
  state.stats[id] = Math.max(stat.min, Math.min(stat.max, state.stats[id] + delta));
}

/** Onset records a warning only. The engine offers care before another advance. */
export function addHealthCondition(world: WorldPack, state: LifeState, id: string, source: string | undefined, hooks: HealthHooks): void {
  if (!world.health || state.phase === "ended") return;
  const condition = definition(world, id);
  const health = healthRecord(world, state)!;
  // Repeated exposure must not reset the episode or erase care already arranged.
  if (health.conditions.some(active => active.id === id)) return;
  health.conditions.push({ id, sinceAge: state.age, lastProgressAge: state.age - 1, care: 0, ...(source ? { source } : {}) });
  health.needsCareDecision = true;
  const opening = condition.kind === "injury" ? "You suffer" : "You develop";
  hooks.journal(`health-onset-${id}`, `${opening} ${condition.title.toLocaleLowerCase()}. You need care.${source ? ` ${source}` : ""}`);
}

/** Care improves the next progression of every current episode, not future ones. */
export function provideHealthCare(world: WorldPack, state: LifeState, amount: number): void {
  if (!world.health || state.phase === "ended") return;
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Health care must be a finite nonnegative amount.");
  const health = state.health;
  if (!health?.conditions.length || amount === 0) return;
  for (const condition of health.conditions) condition.care = unit(condition.care + amount);
  health.lastCareAge = state.age;
}

/**
 * Resolve existing episodes before the engine enters another year. There is no
 * independent death draw: an unresolved named condition must exhaust Health.
 * Recovery is resolved first so care can still help a seriously ill person.
 */
export function progressHealth(world: WorldPack, state: LifeState, hooks: HealthHooks): HealthProgress {
  if (!world.health || state.phase === "ended") return {};
  const model = world.health;
  const health = healthRecord(world, state)!;
  const support = unit(hooks.support);
  const ageLoss = model.declineBands.find(band => state.age >= band.minAge && state.age <= band.maxAge)?.healthLoss ?? 0;
  if (ageLoss > 0) {
    changeHealth(world, state, -ageLoss);
    hooks.journal("health-age-decline", "Your strength is declining with age.");
  }

  const remaining: ActiveHealthCondition[] = [];
  const progressed: { active: ActiveHealthCondition; condition: HealthConditionDefinition; loss: number; care: number }[] = [];
  for (const original of health.conditions) {
    if (original.lastProgressAge >= state.age) { remaining.push(original); continue; }
    const condition = definition(world, original.id);
    const care = unit(original.care);
    const recovery = unit(condition.recoveryChance + care * condition.careRecoveryBonus + support * model.supportRecoveryBonus);
    const recovered = recovery === 1 || recovery > 0 && hooks.random() < recovery;
    if (recovered) {
      hooks.journal(`health-recovery-${original.id}`, `You recover from ${condition.title.toLocaleLowerCase()}.`);
      continue;
    }
    // This reduction is an authored gameplay rule, not a fitted medical effect.
    const loss = condition.healthLoss * (1 - care * 0.5 - support * 0.25);
    const active = { ...original, lastProgressAge: state.age, care: 0 };
    remaining.push(active);
    progressed.push({ active, condition, loss, care });
    hooks.journal(`health-continues-${original.id}`, `${condition.title} continues.${loss > 0 ? " Your health deteriorates." : " You still need care."}`);
  }
  health.conditions = remaining;
  const loss = progressed.reduce((total, item) => total + item.loss, 0);
  if (loss > 0) changeHealth(world, state, -loss);

  const fatal = progressed.filter(item => state.stats[model.stat] <= item.condition.fatalHealthThreshold)
    .sort((left, right) => right.loss - left.loss)[0];
  if (fatal) {
    health.needsCareDecision = false;
    return {
      deathCause: fatal.condition.deathCause,
      context: `${fatal.condition.title} began at age ${fatal.active.sinceAge}. Your health deteriorated while it was active.${fatal.active.source ? ` It followed: ${fatal.active.source}` : ""}${fatal.care > 0 ? " Care was provided, but you did not recover." : " You did not recover."}`,
    };
  }

  health.needsCareDecision = health.conditions.length > 0;
  // Exhaustion/decline is named and warned before it can become fatal. A new
  // episode is deliberately outside the progressed list above.
  if (health.conditions.length === 0 && state.stats[model.stat] <= model.criticalHealth) {
    addHealthCondition(world, state, model.declineCondition, "Your health has fallen to a critical level.", hooks);
  }
  return {};
}

/** Chance of a named illness, scaled by current Health; never a death roll. */
export function developHealthIncident(world: WorldPack, state: LifeState, hooks: HealthHooks): void {
  if (!world.health || state.phase === "ended") return;
  const model = world.health;
  const health = healthRecord(world, state)!;
  if (health.conditions.length === 0 && state.stats[model.stat] <= model.criticalHealth) {
    addHealthCondition(world, state, model.declineCondition, "Your health has fallen to a critical level.", hooks);
  }
  const candidates = model.conditions.filter(condition => condition.weight > 0 &&
    !health.conditions.some(active => active.id === condition.id) && hooks.matches(condition.when));
  if (candidates.length === 0) return;
  const band = model.incidenceBands.find(band => state.age >= band.minAge && state.age <= band.maxAge);
  if (!band || band.annualProbability === 0) return;
  const stat = world.stats[model.stat];
  const ratio = unit((state.stats[model.stat] - stat.min) / (stat.max - stat.min || 1));
  const probability = unit(band.annualProbability * (0.25 + 1.75 * (1 - ratio)));
  if (probability < 1 && hooks.random() >= probability) return;
  let selected = candidates[0];
  if (candidates.length > 1) {
    const maximum = Math.max(...candidates.map(condition => condition.weight));
    const weights = candidates.map(condition => condition.weight / maximum);
    let draw = hooks.random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let index = 0; index < candidates.length; index++) {
      selected = candidates[index];
      draw -= weights[index];
      if (draw < 0) break;
    }
  }
  addHealthCondition(world, state, selected.id, undefined, hooks);
}
