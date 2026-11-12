import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/engine.ts";
import { farmWorkQuote } from "../src/capabilities/farming.ts";
import { applyVocation } from "../src/vocations/engine.ts";
import { vocationCashDelta } from "../src/vocations/view.ts";
import { farmEdgeHealth } from "../src/paths/index.ts";
import { validateWorld } from "../src/validate.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);
const base = engine.start("farm-edge");

/** The same adult life placed in a district; nothing else differs. */
function inDistrict(district: string): LifeState {
  const life = structuredClone(base) as LifeState;
  life.age = 25;
  life.paths!.home = district;
  life.paths!.district = district;
  life.economy!.cash = 1000;
  life.demo!.household.plots = 2;
  return life;
}

test("the Delta village has a farming edge and the city does not", () => {
  assert.deepEqual(world.paths!.districts["delta-village"].farmEdge, { inputBps: 7000, healthPerYear: 1 });
  assert.equal(world.paths!.districts["city-quarter"].farmEdge, undefined);
});

test("farm work fees stay the same everywhere, so every proof keeps its rule", () => {
  assert.equal(farmWorkQuote(world, inDistrict("delta-village"), "F3W").fee, farmWorkQuote(world, inDistrict("city-quarter"), "F3W").fee);
});

test("flax seed costs less in the village, and the supplier receives exactly what is paid", () => {
  const buy = (district: string) => {
    const life = inDistrict(district);
    const cash = life.economy!.cash, merchant = life.vocations!.accounts.merchant;
    const quoted = -vocationCashDelta(world, life, "buy-flax-seed");
    applyVocation(world, life, "buy-flax-seed");
    assert.equal(cash - life.economy!.cash, quoted, "the preview matches the price paid");
    assert.equal(life.vocations!.accounts.merchant - merchant, quoted, "every drachma paid is received");
    return quoted;
  };
  const village = buy("delta-village"), city = buy("city-quarter");
  assert.equal(city, 24);
  assert.equal(village, Math.floor(24 * 7000 / 10_000));
});

test("a year of farm work at home in the village is good for health; elsewhere it is not", () => {
  const farmed = (district: string) => { const life = inDistrict(district); life.capabilities!.farm = { ...(life.capabilities!.farm ?? {}), actionAge: 24 } as never; return life; };
  assert.equal(farmEdgeHealth(world, farmed("delta-village"), 24), 1);
  assert.equal(farmEdgeHealth(world, farmed("city-quarter"), 24), 0);
  assert.equal(farmEdgeHealth(world, inDistrict("delta-village"), 24), 0, "no farm work, no edge");
  const farmer = inDistrict("delta-village");
  farmer.character!.jobId = "tenant-farmer";
  assert.equal(farmEdgeHealth(world, farmer, 24), 1, "a farming job at home counts");
  const away = farmed("delta-village");
  away.paths!.district = "city-quarter";
  assert.equal(farmEdgeHealth(world, away, 24), 0, "a life living away does not work the home fields");
});

test("the engine applies the village health edge and says why", () => {
  const life = inDistrict("delta-village");
  life.character!.jobId = "tenant-farmer";
  let next = life;
  for (let guard = 0; next.age === life.age && guard < 50; guard++) next = next.phase === "choice" ? engine.choose(next, engine.getChoices(next)[0].id) : engine.advance(next);
  assert.ok(next.journal.some(entry => entry.id === "farm-edge-health"), "journal names the edge");
});

test("worlds without paths keep their prices", () => {
  const plain = retained as unknown as WorldPack;
  const life = structuredClone(createEngine(plain).start("farm-edge")) as LifeState;
  life.economy!.cash = 1000;
  assert.equal(-vocationCashDelta(plain, life, "buy-flax-seed"), 24);
});

test("farm edges are validated", () => {
  for (const edge of [{ inputBps: 0, healthPerYear: 1 }, { inputBps: 12_000, healthPerYear: 1 }, { inputBps: 7000, healthPerYear: 9 }, { inputBps: 7000 }]) {
    const bad = structuredClone(world);
    (bad.paths!.districts["delta-village"] as Record<string, unknown>).farmEdge = edge;
    assert.throws(() => validateWorld(bad), /farmEdge/, JSON.stringify(edge));
  }
});

test("the flax-seed purchase does not promise a fixed price that the village does not charge", () => {
  const activity = world.character!.activities.find(item => item.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === "buy-flax-seed")))!;
  assert.doesNotMatch(activity.text, /\(\d+ dr\)/, activity.text);
});
