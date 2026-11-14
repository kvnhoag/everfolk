import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/index.ts";
import { severeEpisodeFatalityProbability } from "../src/health.ts";
import { choiceDeathRisk, formatDeathRiskText, formatHealthRisk, hasReturningIllness, severeHealthRisk } from "../client/models/health-risk.ts";
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

test("turning-point death risk formatting and returning-illness worsening flag work cleanly", () => {
  const engine = createEngine(current);
  const onset = structuredClone(engine.start("onset-flag"));
  onset.age = 23;
  onset.health!.conditions = [{ id: "pneumonia", sinceAge: 23, lastProgressAge: 22, care: 0, severe: { healthBefore: 80 } }];
  assert.equal(hasReturningIllness(onset), false);

  const returning = structuredClone(onset);
  returning.age = 24;
  returning.health!.conditions = [{ id: "pneumonia", sinceAge: 23, lastProgressAge: 23, care: 0, severe: { healthBefore: 72, lingered: 1 } }];
  assert.equal(hasReturningIllness(returning), true);

  assert.equal(formatDeathRiskText({ min: 0.56, max: 0.56, expected: 0.56 }), "Risk of death: 56%");
  assert.equal(formatDeathRiskText({ min: 0, max: 0, expected: 0 }), null);

  // Low-health ordinary illness choice predicts ordinary fatal deterioration upfront.
  const lowHealth = structuredClone(engine.start("ordinary-fatal-risk"));
  lowHealth.age = 25;
  lowHealth.phase = "choice";
  lowHealth.pendingEventId = current.health.careDecision;
  lowHealth.stats.health = 10;
  lowHealth.health!.conditions = [{ id: "pneumonia", sinceAge: 25, lastProgressAge: 24, care: 0 }];
  const careChoices = engine.world.events.find(event => event.id === current.health.careDecision)!.choices;
  const ignore = careChoices.find(choice => choice.id === "carry-on")!;
  const risk = choiceDeathRisk(lowHealth, engine.world, ignore);
  assert.ok(risk && risk.expected > 0, "Carry-on on critical ordinary pneumonia warns of death risk");
});
