import type { ActiveHealthCondition, Condition, HealthConditionDefinition, HealthState, LifeState, WorldPack } from "./types.ts";

export interface HealthHooks {
  random: () => number;
  matches: (condition: Condition | undefined) => boolean;
  journal: (id: string, text: string) => void;
  /** Read-only journal telemetry; omitted in ordinary simulation. */
  changes?: (journalId: string, delta: number) => void;
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

function changeHealth(world: WorldPack, state: LifeState, delta: number): number {
  const id = world.health!.stat;
  const stat = world.stats[id];
  const before = state.stats[id];
  state.stats[id] = Math.max(stat.min, Math.min(stat.max, state.stats[id] + delta));
  return state.stats[id] - before;
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

/** Reference mortality is a baseline, not a health-independent death draw. */
export function calibratedEpisodeProbability(world: WorldPack, state: LifeState): number {
  const calibration = world.health?.mortalityCalibration;
  if (!calibration || state.age < calibration.minAge) return 0;
  const probability = world.mortality?.bands.find(band => state.age >= band.minAge && state.age <= band.maxAge)?.annualProbability ?? 0;
  return unit(probability / calibration.caseFatality);
}

/** Conditional severe-episode risk. Health and care effects are authored rules. */
export function severeEpisodeFatalityProbability(world: WorldPack, state: LifeState, active: ActiveHealthCondition, care = active.care, support = 0): number {
  const model = world.health;
  const calibration = model?.mortalityCalibration;
  if (!model || !calibration || !active.severe) return 0;
  const stat = world.stats[model.stat];
  const healthFactor = 1 + calibration.healthInfluence * (calibration.referenceHealth - active.severe.healthBefore) / (stat.max - stat.min || 1);
  const careFactor = (1 - calibration.careInfluence * unit(care)) / (1 - calibration.careInfluence * calibration.referenceCare);
  return unit(calibration.caseFatality * healthFactor * careFactor * (1 - unit(support) * model.supportRecoveryBonus));
}

/**
 * Resolve existing episodes before the engine enters another year. Fatality
 * requires a warned, active named condition and deterioration to fatal Health.
 * Optional severe episodes have a calibrated baseline with authored care and
 * Health adjustments; ordinary episodes retain their original recovery rules.
 */
export function progressHealth(world: WorldPack, state: LifeState, hooks: HealthHooks): HealthProgress {
  if (!world.health || state.phase === "ended") return {};
  const model = world.health;
  const health = healthRecord(world, state)!;
  const support = unit(hooks.support);
  const ageLoss = model.declineBands.find(band => state.age >= band.minAge && state.age <= band.maxAge)?.healthLoss ?? 0;
  if (ageLoss > 0) {
    const delta = changeHealth(world, state, -ageLoss);
    hooks.journal("health-age-decline", "Your strength is declining with age.");
    hooks.changes?.("health-age-decline", delta);
  }

  const remaining: ActiveHealthCondition[] = [];
  const progressed: { active: ActiveHealthCondition; condition: HealthConditionDefinition; loss: number; care: number }[] = [];
  for (let index = 0; index < health.conditions.length; index++) {
    const original = health.conditions[index];
    if (original.lastProgressAge >= state.age) { remaining.push(original); continue; }
    const condition = definition(world, original.id);
    const care = unit(original.care);
    if (original.severe && model.mortalityCalibration) {
      const probability = severeEpisodeFatalityProbability(world, state, original, care, support);
      const fatal = probability === 1 || probability > 0 && hooks.random() < probability;
      if (fatal) {
        // The warned illness deteriorates sharply during this annual interval.
        // Never raise a lower Health score while recording fatal deterioration.
        const delta = changeHealth(world, state, Math.min(state.stats[model.stat], condition.fatalHealthThreshold) - state.stats[model.stat]);
        // Already recovered episodes stay removed if this later episode is fatal.
        // Unprocessed conditions remain active when death interrupts progression.
        health.conditions = [...remaining, { ...original, lastProgressAge: state.age, care: 0 }, ...health.conditions.slice(index + 1)];
        health.needsCareDecision = false;
        hooks.journal(`health-severe-deterioration-${original.id}`, `Severe ${condition.title.toLocaleLowerCase()} worsens. Your health falls to a fatal level.`);
        hooks.changes?.(`health-severe-deterioration-${original.id}`, delta);
        return { deathCause: condition.deathCause, context: `The recorded illness, ${condition.title}, had become severe. You had been warned before it progressed. The illness began at age ${original.sinceAge}. Your health deteriorated to a fatal level.${original.source ? ` It followed: ${original.source}` : ""}${care > 0 ? " Care was provided, but you did not recover." : " You did not recover."}` };
      }
      const restored = original.severe.healthBefore - ageLoss - model.mortalityCalibration.convalescenceLoss;
      const delta = changeHealth(world, state, Math.max(state.stats[model.stat], restored) - state.stats[model.stat]);
      hooks.journal(`health-recovery-${original.id}`, `You recover from severe ${condition.title.toLocaleLowerCase()}. You need time to regain your strength.`);
      hooks.changes?.(`health-recovery-${original.id}`, delta);
      continue;
    }
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
  if (loss > 0) {
    const delta = changeHealth(world, state, -loss);
    // Conditions resolve together. Share any clamped loss in proportion to
    // each episode's contribution, without changing simulation arithmetic.
    for (const item of progressed) hooks.changes?.(`health-continues-${item.active.id}`, delta * item.loss / loss);
  }

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
  if (model.mortalityCalibration && state.age >= model.mortalityCalibration.minAge) {
    // A severe episode already awaiting care must not be redrawn or replaced.
    if (health.conditions.some(active => active.severe)) return;
    const probability = calibratedEpisodeProbability(world, state);
    if (probability > 0 && (probability === 1 || hooks.random() < probability)) {
      const candidates = model.conditions.filter(condition => condition.kind === "illness" && condition.weight > 0 && hooks.matches(condition.when));
      if (!candidates.length) throw new Error("Mortality calibration requires an eligible illness.");
      const selected = selectCondition(candidates, hooks);
      const healthBefore = state.stats[model.stat];
      const existing = health.conditions.find(active => active.id === selected.id);
      if (!existing) addHealthCondition(world, state, selected.id, undefined, hooks);
      const active = existing ?? health.conditions.find(active => active.id === selected.id)!;
      active.severe = { healthBefore };
      active.lastProgressAge = state.age - 1;
      const delta = changeHealth(world, state, Math.min(healthBefore, model.mortalityCalibration.onsetHealth) - healthBefore);
      health.needsCareDecision = true;
      hooks.journal(`health-severe-onset-${selected.id}`, `${selected.title} has become severe. Your health has fallen sharply. You need care before the illness can progress.`);
      hooks.changes?.(`health-severe-onset-${selected.id}`, delta);
      return;
    }
  }
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
  addHealthCondition(world, state, selectCondition(candidates, hooks).id, undefined, hooks);
}

function selectCondition(candidates: HealthConditionDefinition[], hooks: HealthHooks): HealthConditionDefinition {
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
  return selected;
}
