import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { buildLifeStageWorld } from "../src/vocations/life-stage-world.ts";
import { FIELD_IDS } from "../src/paths/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import base from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import shipped from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);
const previous = createEngine(retained as unknown as WorldPack);

function bornAs(origin: string): LifeState {
  for (let i = 0; i < 400; i++) {
    const life = engine.start(`world-birth-${i}`);
    if (life.originId === origin) return life;
  }
  throw new Error(`no ${origin} birth in 400 seeds`);
}

test("the free-play world carries fields, districts and the two new birthplaces", () => {
  assert.deepEqual(buildLifeStageWorld(base as unknown as WorldPack), world);
  assert.deepEqual(Object.keys(world.paths!.fields), [...FIELD_IDS]);
  assert.deepEqual(Object.keys(world.paths!.districts), ["delta-village", "garrison", "estate", "city-quarter", "court-quarter"]);
  assert.equal(world.origins.length, 6);
  assert.ok(world.origins.some(origin => origin.id === "artisan-household"));
  assert.ok(world.origins.some(origin => origin.id === "royal-household"));
  for (const field of FIELD_IDS) assert.ok(world.flags[`met-renowned-${field}`], `flag for ${field}`);
});

test("a royal birth starts in the court quarter with papers to learn from", () => {
  const life = bornAs("royal-household");
  assert.equal(life.paths!.district, "court-quarter");
  assert.equal(life.vocations!.inventory.papyrus, 6);
  assert.equal(life.vocations!.inventory.ink, 4);
  assert.ok(life.demo!.goods.silver >= 2 && life.demo!.goods.silver <= 4);
  assert.equal(life.paths!.affinity.civic, 10);
});

test("an artisan birth starts in the city quarter with clay by the door", () => {
  const life = bornAs("artisan-household");
  assert.equal(life.paths!.district, "city-quarter");
  assert.equal(life.vocations!.inventory.clay, 4);
  assert.equal(life.vocations!.inventory.fuel, 2);
  assert.equal(life.paths!.affinity.ceramics, 10);
});

test("the district shapes who lives around you", () => {
  const village = bornAs("tenant-farming-household"), court = bornAs("royal-household");
  assert.equal(village.paths!.district, "delta-village");
  assert.ok(village.paths!.people.farming[1] > court.paths!.people.farming[1]);
  assert.ok(court.paths!.people.research[3] >= 0 && court.paths!.people.research[1] > village.paths!.people.research[1]);
});

test("existing birthplaces keep their starting resources", () => {
  let compared = 0;
  for (let i = 0; i < 60; i++) {
    const seed = `keep-resources-${i}`;
    const now = engine.start(seed), before = previous.start(seed);
    if (now.originId !== before.originId) continue;
    compared++;
    assert.equal(now.demo!.household.grain, before.demo!.household.grain);
    assert.deepEqual(now.demo!.goods, before.demo!.goods);
  }
  assert.ok(compared > 10, `compared ${compared} births`);
});

test("every military appointment offered by an event asks for its proved qualification", () => {
  const military = new Set(["soldier", "officer", "general"]);
  const mentions = (condition: unknown): boolean => JSON.stringify(condition ?? null).includes('"type":"capability"');
  for (const event of world.events) for (const choice of event.choices) {
    const appoints = choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job !== null && military.has(effect.job)));
    if (appoints) assert.ok(mentions(choice.when), `${event.id}/${choice.id} appoints without a qualification`);
  }
});

test("war recruiting offers drilling to anyone not yet qualified to sign, so the offer is never a dead end", () => {
  const recruiting = world.events.find(event => event.id === "need-war-recruiting")!;
  const drill = recruiting.choices.find(choice => choice.id.endsWith("-drill"))!;
  assert.deepEqual(drill.when, { type: "not", condition: { type: "capability", node: "M4" } });
});

test("military service builds the body it demands, and command builds the voice", () => {
  const yearly = (job: string) => world.character!.jobs.find(item => item.id === job)!.yearlyEffects!.flatMap(effect => effect.type === "skill" ? [`${effect.skill}+${effect.delta}`] : []);
  for (const job of ["soldier", "officer", "general"]) for (const gain of ["warfare+2", "strength+1", "endurance+1"]) assert.ok(yearly(job).includes(gain), `${job}: ${yearly(job).join(", ")}`);
  for (const job of ["officer", "general"]) assert.ok(yearly(job).includes("oratory+1"), job);
  assert.ok(!yearly("soldier").includes("oratory+1"));
});
