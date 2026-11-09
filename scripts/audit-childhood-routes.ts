import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createEngine } from "../src/index.ts";
import { selectAutomaticChoice } from "../client/yearly-focus.ts";
import input from "../worlds/alexandria-sample.json" with { type: "json" };
import type { WorldPack } from "../src/types.ts";

// Uses only ordinary start/advance/choose commands; all saved QA fixtures replay.
const world = input as WorldPack, engine = createEngine(world);
const events = new Map(world.events.map(event => [event.id, event]));
const groups = new Map<string, Set<string>>();
for (const event of world.events) if (event.exclusiveGroup) groups.set(event.exclusiveGroup, new Set());
const seenAmbient = new Set<string>(), seenRecalls = new Set<string>(), sequences = new Set<string>(), interests = new Set<string>();
const directory = new URL("../artifacts/", import.meta.url);
mkdirSync(directory, { recursive: true });
const incompleteStages: { seed: string; age: number; phase: string; stages: string[]; ending: string | undefined }[] = [];
let earlyFixture = false, visitorsFixture = false, trainingFixture = false, reached18 = 0, completeStages = 0, replayChecks = 0;
for (let seed = 0; seed < 256; seed++) {
  let life = engine.start(`childhood-routes-audit-${seed}`);
  for (let command = 0; command < 160 && life.phase !== "ended" && (life.age < 25 || life.phase === "choice"); command++) {
    if (life.phase === "choice") {
      if (!earlyFixture && life.age === 3 && life.pendingEventId?.startsWith("child-route-care-")) {
        writeFileSync(new URL("qa-early-choice.json", directory), engine.save(life)); earlyFixture = true;
      }
      if (!visitorsFixture && life.age === 3 && life.pendingEventId === "early-care-visitors") {
        writeFileSync(new URL("qa-early-visitors.json", directory), engine.save(life)); visitorsFixture = true;
      }
      const choices = engine.getChoices(life);
      const newInterest = choices.find(choice => choice.outcomes.every(outcome => outcome.effects.some(effect =>
        effect.type === "flag" && effect.flag.startsWith("early-interest-") && effect.value && !life.flags[effect.flag])));
      life = engine.choose(life, (newInterest ?? selectAutomaticChoice(choices, world, life)!).id);
    } else {
      if (!trainingFixture && life.age >= 8 && life.age < 12 && life.flags["early-interest-sculpture"] && engine.getActivities(life).some(activity => activity.id === "train-craft" && activity.available)) {
        writeFileSync(new URL("qa-early-training.json", directory), engine.save(life)); trainingFixture = true;
      }
      life = engine.advance(life);
    }
  }
  const milestones = life.journal.filter(entry => entry.type === "event" && events.get(entry.id)?.exclusiveGroup);
  const stageNames = milestones.map(entry => events.get(entry.id)!.exclusiveGroup!);
  assert.equal(new Set(stageNames).size, stageNames.length, "Only one alternative is offered per stage.");
  for (const entry of milestones) groups.get(events.get(entry.id)!.exclusiveGroup!)!.add(entry.id);
  sequences.add(milestones.map(entry => entry.id).join("|"));
  if (life.age >= 18) reached18++;
  if (stageNames.length === 5) completeStages++;
  else incompleteStages.push({ seed: life.seed, age: life.age, phase: life.phase, stages: stageNames, ending: life.endingId });
  for (const entry of life.journal) {
    if (entry.id.startsWith("child-memory-ambient-")) seenAmbient.add(entry.id);
    if (entry.id.startsWith("early-interest-recalled-")) seenRecalls.add(entry.id);
  }
  for (const route of world.legacy!.routes) if (life.flags[route.earlyInterestFlag!]) interests.add(route.id);
  if (seed < 32) {
    assert.deepEqual(engine.load(engine.save(life)), life);
    assert.deepEqual(engine.replay(life.seed, life.commands), life);
    replayChecks++;
  }
}
for (const [name, seen] of groups) assert.equal(seen.size, world.events.filter(event => event.exclusiveGroup === name).length, name);
assert.equal(seenAmbient.size, 12); assert.equal(seenRecalls.size, 7); assert.equal(interests.size, 7);
assert.ok(earlyFixture && visitorsFixture && trainingFixture);
const lessons = world.character!.activities.filter(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "skill" && effect.gainModifiers)));
const skillEffects = lessons.flatMap(activity => activity.outcomes.flatMap(outcome => outcome.effects.filter(effect => effect.type === "skill" && effect.gainModifiers)));
const boostedChoices = [...world.character!.activities, ...world.events.flatMap(event => event.choices)].filter(choice => choice.outcomes.some(outcome => outcome.weightModifiers?.some(modifier => modifier.reason.startsWith("A remembered early interest"))));
const result = {
  version: world.version, fingerprint: engine.fingerprint, seeds: 256, reached18, completeStages, incompleteStages, distinctOpeningSequences: sequences.size, replayChecks,
  alternatives: Object.fromEntries([...groups].map(([name, seen]) => [name, { count: seen.size, ids: [...seen].sort() }])),
  ambientScenesSeen: seenAmbient.size, recognitionScenesSeen: seenRecalls.size, interestsSeen: [...interests].sort(),
  paidTrainingActivities: lessons.length, boostedSkillEffects: skillEffects.length,
  skillGainModifiers: skillEffects.reduce((sum, effect) => sum + (effect.type === "skill" ? effect.gainModifiers!.length : 0), 0),
  weightedOpportunities: boostedChoices.length, weightedActivityOpportunities: boostedChoices.filter(choice => "category" in choice).length,
  weightedEventChoices: boostedChoices.filter(choice => !("category" in choice)).length,
  weightedIds: boostedChoices.map(choice => choice.id),
  fixtures: ["artifacts/qa-early-choice.json", "artifacts/qa-early-visitors.json", "artifacts/qa-early-training.json"],
};
writeFileSync(new URL("childhood-routes-audit.json", directory), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
