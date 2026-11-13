import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/index.ts";
import { severeEpisodeFatalityProbability } from "../src/health.ts";
import { severeHealthRisk, formatHealthRisk } from "../client/models/health-risk.ts";
import { selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };

test("care choices disclose exact severe-episode risk without changing the life or randomness", () => {
  const engine = createEngine(current), life = structuredClone(engine.start("care-preview"));
  life.age = 40; life.year = -26; life.phase = "choice"; life.pendingEventId = current.health.careDecision;
  life.health!.conditions = [{ id: "pneumonia", sinceAge: 40, lastProgressAge: 39, care: 0, severe: { healthBefore: 50 } }];
  const before = structuredClone(life);
  const choices = engine.world.events.find(event => event.id === current.health.careDecision)!.choices;
  const resting = severeHealthRisk(life, engine.world, choices.find(choice => choice.id === "rest-and-care"))!;
  const healer = severeHealthRisk(life, engine.world, choices.find(choice => choice.id === "consult-healer"))!;
  const ignore = severeHealthRisk(life, engine.world, choices.find(choice => choice.id === "carry-on"))!;
  assert.ok(Math.abs(resting.min - .8) < 1e-12);
  assert.ok(healer.max < resting.min && resting.max < ignore.min);
  assert.equal(selectAutomaticChoice(choices, engine.world, life)?.id, "consult-healer", "Auto respects the disclosed severe-illness risk.");
  assert.equal(severeHealthRisk(life, engine.world)!.min, severeEpisodeFatalityProbability(engine.world, life, life.health!.conditions[0]));
  assert.deepEqual(life, before);
  assert.equal(formatHealthRisk({ min: .125, max: .25 }), "12.5-25%");
  assert.equal(severeHealthRisk(life, engine.world, engine.world.character!.activities.find(activity => activity.id === "train-pottery")), undefined, "Unrelated actions do not pretend to change severe illness risk.");
});

test("ordinary episodes and older worlds keep their existing health display", () => {
  const engine = createEngine(current), life = structuredClone(engine.start("ordinary-preview"));
  life.health!.conditions = [{ id: "pneumonia", sinceAge: 0, lastProgressAge: -1, care: 0 }];
  assert.equal(severeHealthRisk(life, engine.world), undefined);
});
