import { writeFileSync } from "node:fs";
import { createEngine } from "../src/index.ts";
import { getOutcomeProbabilities } from "../src/outcomes.ts";
import type { Choice, Condition, LegacyRouteDefinition, LifeState, WorldPack } from "../src/types.ts";
import { selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };

const world = pack as WorldPack, engine = createEngine(world);
const count = Number(process.argv[2] ?? 32);
const saveExamples = process.argv.includes("--save-examples");
if (!Number.isInteger(count) || count < 8 || count > 512) throw new Error("Use 8..512 seeds per route.");

function targets(route: LegacyRouteDefinition): Record<string, number> {
  const id = route.achievementIds[0];
  const activity = world.character!.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === id)))!;
  const result: Record<string, number> = {};
  const require = (id: string, value: number) => {
    result[id] = Math.max(value, result[id] ?? 0);
    for (const [key, minimum] of Object.entries(world.character!.skills[id].prerequisites ?? {})) require(key, minimum);
  };
  const visit = (condition?: Condition): void => {
    if (!condition) return;
    if (condition.type === "skill" && ["gte", "gt"].includes(condition.op)) require(condition.skill, condition.value);
    else if (condition.type === "all" || condition.type === "any") condition.conditions.forEach(visit);
  };
  visit(activity.when);
  return result;
}
function choose(life: LifeState, wanted: Record<string, number>): Choice {
  const choices = engine.getChoices(life);
  if (life.pendingEventId === world.health?.careDecision) return selectAutomaticChoice(choices, world, life)!;
  const safe = choices.filter(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => !["end", "condition", "loan"].includes(effect.type))));
  if (!safe.length) return selectAutomaticChoice(choices, world, life)!;
  const score = (choice: Choice) => getOutcomeProbabilities(world, life, choice).reduce((sum, { outcome, probability }) => sum + probability * outcome.effects.reduce((value, effect) => {
    if (effect.type === "skill") return value + Math.max(0, effect.delta) * (life.character!.skills[effect.skill] < (wanted[effect.skill] ?? 0) ? 4 : .05);
    if (effect.type === "stat" && effect.stat === "health") return value + effect.delta * .2;
    if (effect.type === "cash") return value + effect.delta * .01;
    if (effect.type === "job" && effect.job && !life.character!.jobId) return value + 2;
    return value;
  }, 0), 0);
  return safe.reduce((best, choice) => score(choice) > score(best) ? choice : best);
}
const reports = world.legacy!.routes.map(route => {
  const wanted = targets(route), achieved: number[] = [];
  const origins: Record<string, { runs: number; earned: number }> = {};
  const examples: { seed: string; age: number; origin: string }[] = [];
  let survived18 = 0, endedBeforeAward = 0;
  for (let index = 0; index < count; index++) {
    const seed = `legacy-pacing-${route.id}-${index}`;
    let life = engine.start(seed), reached18 = false, steps = 0;
    origins[life.originId] ??= { runs: 0, earned: 0 }; origins[life.originId].runs++;
    while (life.phase !== "ended" && !life.accomplishments!.some(record => record.achievementId === route.achievementIds[0])) {
      if (++steps > 1200) throw new Error(`Policy stalled for ${seed}`);
      if (life.age >= 18) reached18 = true;
      if (life.phase === "choice") { life = engine.choose(life, choose(life, wanted).id); continue; }
      let available = engine.getActivities(life).filter(activity => activity.available);
      const care = available.find(activity => activity.usesYearlyActivity === false && activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "care")));
      if (care) { life = engine.act(life, care.id); continue; }
      const award = available.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === route.achievementIds[0])));
      if (award) { life = engine.act(life, award.id); continue; }
      if (route.id === "military" && available.some(activity => activity.id === "enlist-royal-army")) { life = engine.act(life, "enlist-royal-army"); continue; }
      if (!life.character!.jobId && (life.age >= 14 || life.economy!.cash < 20)) {
        const work = available.filter(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job))).find(activity => activity.id === "work-porter")
          ?? available.find(activity => activity.id === "work-apprentice");
        if (work) { life = engine.act(life, work.id); continue; }
      }
      const lessons = Object.entries(wanted).filter(([id, value]) => life.character!.skills[id] < value)
        .map(([id]) => available.find(activity => activity.id === world.character!.skills[id].trainingActivity))
        .filter(activity => activity !== undefined);
      if (lessons.length) { life = engine.act(life, lessons[0]!.id); continue; }
      const smallPaid = available.find(activity => activity.id === "help-count-stock");
      if (smallPaid && life.economy!.cash < 30) { life = engine.act(life, smallPaid.id); continue; }
      life = engine.advance(life);
    }
    if (reached18) survived18++;
    const record = life.accomplishments!.find(record => record.achievementId === route.achievementIds[0]);
    if (record) {
      achieved.push(record.age); origins[life.originId].earned++;
      if (examples.length < 3) examples.push({ seed, age: record.age, origin: life.originId });
      if (examples.length === 1) {
        const restored = engine.load(engine.save(life));
        if (JSON.stringify(restored) !== JSON.stringify(life)) throw new Error(`Replay mismatch ${seed}`);
        if (saveExamples) writeFileSync(new URL(`../artifacts/qa-life-${route.id}.json`, import.meta.url), engine.save(life));
      }
    } else endedBeforeAward++;
  }
  achieved.sort((a, b) => a - b);
  return { route: route.id, runs: count, survivedTo18BeforeAwardOrEnd: survived18, earned: achieved.length, endedBeforeAward,
    ageAtAward: achieved.length ? { min: achieved[0], median: achieved[Math.floor(achieved.length / 2)], max: achieved.at(-1) } : null,
    backgrounds: origins, reproducibleExamples: examples };
});
const result = { worldVersion: world.version, fingerprint: engine.fingerprint, seedsPerRoute: count,
  mortality: "Health and mortality definitions remain equal to archived 0.25 and 0.24 settings.",
  policy: "Route-focused paid learning respecting prerequisites and annual action limits; safe decisions; care; porter/apprentice income when needed; ordinary milestone when available; no state edits or waived requirements.",
  limitation: "Bounded seeded simulation; route-specific policies change decisions and RNG consumption. Award rates are not historical probabilities, randomized treatment effects, or guarantees for every playthrough. This audit stops at the first ordinary accomplishment.", reports };
writeFileSync(new URL("../artifacts/legacy-pacing-2026-11-08.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
