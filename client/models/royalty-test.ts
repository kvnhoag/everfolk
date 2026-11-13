import { createEngine } from "../../src/engine.ts";
import { yearAtAge } from "../../src/calendar.ts";
import { ROYAL_METRICS } from "../../src/royalty.ts";
import { ARISTOCRAT_METRICS } from "../../src/aristocracy.ts";
import { validateWorld } from "../../src/validate.ts";
import type { AristocratMetric, Condition, Effect, LifeEngine, LifeState, RoyalMetric } from "../../src/types.ts";
import currentWorld from "../../worlds/alexandria-sample.json" with { type: "json" };

export type RoyaltyTestPresetId = "comfortable" | "struggling" | "succession" | "aristocrat-comfortable" | "aristocrat-struggling" | "aristocrat-inheritance";
interface TestPresetBase {
  id: RoyaltyTestPresetId;
  label: string;
  description: string;
  age: number;
}
export type RoyaltyTestPreset = TestPresetBase & (
  { socialClass: "royal"; metrics: Record<RoyalMetric, number> } |
  { socialClass: "aristocrat"; metrics: Record<AristocratMetric, number> }
);

export const ROYALTY_TEST_PRESETS: readonly RoyaltyTestPreset[] = [
  { id: "comfortable", socialClass: "royal", label: "Comfortable royal house", description: "A well-funded royal house with room to try every council decision.", age: 25,
    metrics: { treasury: 2000, influence: 65, stability: 70, security: 65, succession: 40 } },
  { id: "struggling", socialClass: "royal", label: "Royal house under pressure", description: "Low reserves, strained alliances and weak protection make the annual penalties visible.", age: 25,
    metrics: { treasury: 45, influence: 18, stability: 20, security: 20, succession: 15 } },
  { id: "succession", socialClass: "royal", label: "Royal succession crisis", description: "An established royal house needs a clear plan for its next generation.", age: 45,
    metrics: { treasury: 1200, influence: 50, stability: 55, security: 55, succession: 10 } },
  { id: "aristocrat-comfortable", socialClass: "aristocrat", label: "Prosperous aristocratic estate", description: "Invest in the land, strengthen tenant agreements and build local standing.", age: 25,
    metrics: { treasury: 1400, standing: 55, prosperity: 65, loyalty: 65, inheritance: 40 } },
  { id: "aristocrat-struggling", socialClass: "aristocrat", label: "Estate under pressure", description: "Poor upkeep, weak tenant trust and thin reserves expose the costs of neglect.", age: 25,
    metrics: { treasury: 45, standing: 18, prosperity: 20, loyalty: 20, inheritance: 15 } },
  { id: "aristocrat-inheritance", socialClass: "aristocrat", label: "Disputed inheritance", description: "An established landowning family needs an agreement to keep its estate together.", age: 45,
    metrics: { treasury: 1000, standing: 50, prosperity: 55, loyalty: 55, inheritance: 10 } },
];

export interface RoyaltyTestSession { engine: LifeEngine; life: LifeState; preset: RoyaltyTestPreset; atBirth?: boolean }

/** A separate, in-memory test world; production packs and personal saves stay untouched.
 * Preset values are applied by an authored test event, so even the adult checkpoint
 * remains a valid sequence of engine commands rather than a forged snapshot. */
export function createRoyaltyTestSession(presetId = "comfortable", { atBirth = false }: { atBirth?: boolean } = {}): RoyaltyTestSession {
  const selected = ROYALTY_TEST_PRESETS.find(item => item.id === presetId);
  if (!selected) throw new Error(`Unknown royalty test preset: ${presetId}`);
  const preset = atBirth ? { ...selected, age: 0, description: "A newborn household member is ready for the birth reveal and household introduction." } : selected;
  const world: unknown = structuredClone(currentWorld);
  validateWorld(world);
  const management = preset.socialClass === "royal" ? world.royalty : world.aristocracy;
  if (!management) throw new Error("The current world has no rules for this household class.");
  world.id = preset.socialClass === "royal" ? "alexandria-royalty-test" : "alexandria-aristocrat-test";
  world.version = `${world.version}-test-${preset.id}${atBirth ? "-birth" : ""}`;
  world.title = preset.socialClass === "royal" ? "Royal council test" : "Aristocratic estate test";
  world.description = "An isolated, fictional test session for this household's management rules.";

  // A testing session starts healthy and suppresses involuntary death and ageing.
  for (const band of world.mortality?.bands ?? []) band.annualProbability = 0;
  if (world.health) {
    delete world.health.mortalityCalibration;
    for (const band of world.health.incidenceBands) band.annualProbability = 0;
    for (const band of world.health.declineBands) band.healthLoss = 0;
  }
  if (world.knowledge) {
    world.knowledge.idleLoss = 0;
    for (const band of world.knowledge.ageBands) band.loss = 0;
  }
  // Adult checkpoints start with the requested health, without recording a
  // synthetic illness/recovery in the regular game's scene and event feed.
  if (world.yearlyRules) world.yearlyRules = world.yearlyRules.filter(rule => rule.id !== "growing-child");
  for (const origin of world.origins) {
    origin.statRanges = { ...origin.statRanges, health: { min: 85, max: 85 } };
    origin.weight = origin.id === management.originId ? 1_000_000 : 1;
  }

  const checkpointYear = yearAtAge(world.startYear, preset.age);
  for (const event of world.events) {
    // Definitions remain present for all content references, while already-past
    // childhood scenes cannot form an adult backlog after opening the test page.
    const alreadyPast = event.trigger.type === "age" && event.trigger.at <= preset.age ||
      event.trigger.type === "year" && event.trigger.at <= checkpointYear;
    const gate: Condition = alreadyPast ? { type: "age", op: "lt", value: 0 } : { type: "age", op: "gte", value: preset.age + 1 };
    event.when = { type: "all", conditions: [...(event.when ? [event.when] : []), gate] };
  }
  const effects: Effect[] = preset.socialClass === "royal" ? ROYAL_METRICS.flatMap(metric => [
    { type: "royal", metric, delta: -world.royalty!.metrics[metric].max },
    { type: "royal", metric, delta: preset.metrics[metric] },
  ]) : ARISTOCRAT_METRICS.flatMap(metric => [
    { type: "aristocrat", metric, delta: -world.aristocracy!.metrics[metric].max },
    { type: "aristocrat", metric, delta: preset.metrics[metric] },
  ]);
  for (const [stat, value] of [["knowledge", 50], ["bonds", 60]] as const) {
    // Reach the cap before reducing to the preset, so diminishing positive
    // gains cannot leave a supposedly healthy test life in the recovery scene.
    effects.push({ type: "stat", stat, delta: world.stats[stat].max * 100 }, { type: "stat", stat, delta: value - world.stats[stat].max });
  }
  for (const [skill, value] of [["literacy", 25], ["oratory", 25], ["reckoning", 25]] as const) {
    effects.push({ type: "skill", skill, delta: -world.character!.skills[skill].max }, { type: "skill", skill, delta: value });
  }
  world.events.push({
    id: "royalty-test-checkpoint", title: "The test house is ready", text: preset.description,
    trigger: { type: "age", at: preset.age }, mode: "automatic", audience: preset.socialClass, evidence: "fictional", sourceIds: [], choices: [], effects,
  });

  const engine = createEngine(world);
  let life: LifeState | undefined;
  for (let index = 0; index < 512; index++) {
    const candidate = engine.start(`royalty-test-${preset.id}-${index}`);
    if (candidate.originId === management.originId) { life = candidate; break; }
  }
  if (!life) throw new Error("A royal test household could not be prepared.");
  while (life.age < preset.age && life.phase === "ready") life = engine.advance(life);
  if (life.age !== preset.age || life.phase !== "ready" || !life.eventCounts["royalty-test-checkpoint"]) {
    throw new Error("The royal test checkpoint could not be reached.");
  }
  return { engine, life, preset, ...(atBirth ? { atBirth: true } : {}) };
}
