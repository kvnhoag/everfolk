import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { matchesCondition } from "../src/conditions.ts";
import { FIELD_IDS } from "../src/paths/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-8.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);
const events = new Map(world.events.map(event => [event.id, event]));
const born = engine.start("paths-content-boundaries");

function at(age: number): LifeState {
  const life = structuredClone(born);
  life.age = age;
  life.year = world.startYear + age;
  life.character!.jobId = "porter";
  return life;
}

test("each field retains inspiration events in every authored stage band", () => {
  for (const field of FIELD_IDS) for (const band of ["child", "young", "adult", "elder"]) {
    const event = events.get(`inspire-${field}-${band}`);
    assert.ok(event, `${field}: ${band}`);
    assert.deepEqual(event.fields, [field]);
    assert.ok(event.stages?.length);
  }
});

test("scarce-field offers require scarcity and close for both steady and crowded fields", () => {
  for (const field of FIELD_IDS) {
    const event = events.get(`need-scarce-${field}`)!;
    assert.ok(event, field);
    const life = at(25);
    for (const label of ["scarce", "steady", "crowded"] as const) {
      life.paths!.needs[field].label = label;
      assert.equal(matchesCondition(event.when, life), label === "scarce", `${field}: ${label}`);
    }
  }
});

test("recruiting requires an adult civilian in a war year and respects drill and fitness", () => {
  const event = events.get("need-war-recruiting")!;
  const life = at(18);
  life.demo!.year.army = "war";
  assert.equal(matchesCondition(event.when, life), true);
  life.age = 17;
  assert.equal(matchesCondition(event.when, life), false);
  life.age = 18;
  life.demo!.year.army = "quiet";
  assert.equal(matchesCondition(event.when, life), false);
  life.demo!.year.army = "war";
  life.character!.jobId = "soldier";
  assert.equal(matchesCondition(event.when, life), false);
  life.character!.jobId = "porter";
  life.phase = "choice";
  life.pendingEventId = event.id;
  delete life.capabilities!.learned.M4;
  assert.ok(engine.getChoices(life).some(choice => choice.id.endsWith("-drill")));
  assert.ok(!engine.getChoices(life).some(choice => choice.id.endsWith("-enlist")));
  life.capabilities!.learned.M4 = { age: 18, year: life.year };
  const drill = world.capabilities!.nodes.find(node => node.id === "M4")!;
  for (const [id, value] of Object.entries(drill.minimumStats ?? {})) life.stats[id] = value + 5;
  for (const [id, value] of Object.entries(drill.minimumProficiency)) life.character!.skills[id] = value;
  life.stats.health = 30;
  assert.ok(!engine.getChoices(life).some(choice => choice.id.endsWith("-enlist")));
  life.stats.health = 100;
  const enlist = engine.getChoices(life).find(choice => choice.id.endsWith("-enlist"));
  assert.ok(enlist);
  assert.equal(engine.choose(life, enlist.id).character!.jobId, "soldier");
});

test("an introduced apprenticeship moves the player while preserving the household's home", () => {
  const event = events.get("move-city-apprenticeship")!;
  const life = at(16);
  life.paths!.home = "delta-village";
  life.paths!.district = "delta-village";
  life.paths!.introductions = [];
  assert.equal(matchesCondition(event.when, life), false);
  life.paths!.introductions.push("ceramics");
  assert.equal(matchesCondition(event.when, life), true);
  life.phase = "choice";
  life.pendingEventId = event.id;
  const moved = engine.choose(life, "move-city-apprenticeship-go");
  assert.equal(moved.paths!.district, "city-quarter");
  assert.equal(moved.paths!.home, life.paths!.home);
  assert.equal(moved.originId, life.originId);
  assert.equal(life.paths!.district, "delta-village");
});

test("holdings, need and move stories do not grant free cash or goods; harvest bonuses have a cost", () => {
  for (const event of world.events.filter(event => /^(?:holdings|need|move)-/.test(event.id))) {
    const effects = [...(event.effects ?? []), ...event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects))];
    assert.ok(!effects.some(effect => effect.type === "cash" && effect.delta > 0 ||
      effect.type === "demo" && (effect.effect.kind === "grain" || effect.effect.kind === "item") && effect.effect.delta > 0), event.id);
    for (const choice of event.choices) for (const outcome of choice.outcomes) {
      if (!outcome.effects.some(effect => effect.type === "demo" && effect.effect.kind === "harvest-bonus")) continue;
      assert.ok(choice.when, choice.id);
      assert.ok(outcome.effects.some(effect => effect.type === "cash" && effect.delta < 0 ||
        effect.type === "demo" && (effect.effect.kind === "grain" || effect.effect.kind === "item") && effect.effect.delta < 0), choice.id);
    }
  }
});
