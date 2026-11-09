import { withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine } from "../src/index.ts";
import { getAssetValue, getNetWorth } from "../src/economy.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import economyRelease from "../worlds/alexandria-0.9.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.8.0.json" with { type: "json" };

function controlledWorld(): WorldPack {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.stats.wealth.initial = 80;
  world.stats.wealth.initialRange = { min: 80, max: 80 };
  for (const origin of world.origins) origin.statRanges!.wealth = { min: 80, max: 80 };
  world.events = world.events.filter(event => ["the-first-household", world.health!.careDecision].includes(event.id));
  world.yearlyEffects = [];
  world.yearlyRules = [];
  return world;
}

function settle(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}

function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  life = settle(engine, life);
  while (life.phase !== "ended" && life.age < target) life = settle(engine, engine.advance(life));
  assert.equal(life.age, target);
  assert.equal(life.phase, "ready");
  return life;
}

test("the economy release retains all earlier life content and discloses its authored prices", () => {
  const stripped = structuredClone(economyRelease) as WorldPack;
  delete stripped.economy;
  stripped.version = previous.version;
  stripped.stats.wealth.label = previous.stats.wealth.label;
  stripped.character!.activities = stripped.character!.activities.filter(activity => activity.category !== "finance");
  stripped.sources = stripped.sources!.filter(source => source.id !== "ucl-ptolemaic-coins");
  assert.deepEqual(stripped, previous);
  assert.equal(economyRelease.version, "0.9.0");
  assert.equal(pack.economy.unitsPerPoint, 10);
  assert.deepEqual(pack.economy.currency, { singular: "drachma", plural: "drachmas", short: "dr" });
  assert.match(pack.economy.description, /not reconstructed historical prices or wages/);
  assert.match(pack.economy.description, /no modern-currency conversion or automatic interest/);
  assert.deepEqual(pack.economy.sourceIds, ["ucl-ptolemaic-coins"]);
  assert.equal(pack.sources.find(source => source.id === "ucl-ptolemaic-coins")!.url,
    "https://www.ucl.ac.uk/museums-static/digitalegypt/metal/coins.html");
});

test("household money inherits origin rolls without consuming a new birth draw", () => {
  const before = createEngine(previous), engine = createEngine(economyRelease);
  const origins = new Set<string>();
  const balances = new Set<number>();
  for (let index = 0; index < 128; index++) {
    const seed = `money-origin-parity-${index}`;
    const prior = before.start(seed), life = engine.start(seed);
    for (const field of ["originId", "stats", "character", "rngState", "pendingEventId", "journal", "commands"] as const) {
      assert.deepEqual(life[field], prior[field], `${seed}: ${field}`);
    }
    assert.equal(life.economy!.cash, prior.stats.wealth * 10);
    assert.equal(life.economy!.debt, 0);
    assert.equal(getAssetValue(engine.world, life), 0);
    assert.equal(getNetWorth(engine.world, life), life.economy!.cash);
    const range = economyRelease.origins.find(origin => origin.id === life.originId)!.statRanges.wealth;
    assert.ok(life.economy!.cash >= range.min * 10 && life.economy!.cash <= range.max * 10);
    origins.add(life.originId);
    balances.add(life.economy!.cash);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.equal(origins.size, 3);
  assert.ok(balances.size >= 15);
});

test("lessons and work use readable monetary amounts while retaining the annual action limit", () => {
  const engine = createEngine(controlledWorld());
  let life = ageTo(engine, engine.start("money-lessons-and-work"), 6);
  assert.equal(life.economy!.cash, 800);
  life = engine.act(life, "train-literacy");
  assert.equal(life.economy!.cash, 780, "A two-point lesson costs 20 drachmas.");
  assert.equal(life.character!.skills.literacy, 6);
  assert.throws(() => engine.act(life, "train-literacy"), /major activity/);
  life = ageTo(engine, life, 10);
  life = engine.act(life, "train-craft");
  assert.equal(life.economy!.cash, 770, "Workshop practice costs 10 drachmas.");
  life = ageTo(engine, life, 16);
  life = engine.act(life, "work-porter");
  const beforeWage = life.economy!.cash;
  life = engine.advance(life);
  assert.equal(life.economy!.cash - beforeWage, 20, "The quay porter receives the authored annual 20-drachma return.");
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("buying and selling preserve net worth while only ownership produces annual income", () => {
  const engine = createEngine(controlledWorld());
  let life = ageTo(engine, engine.start("workshop-share-ledger"), 17);
  assert.equal(engine.getActivities(life).find(activity => activity.id === "buy-workshop-share")!.available, false);
  life = ageTo(engine, life, 18);
  const netWorth = getNetWorth(engine.world, life);
  life = engine.act(life, "buy-workshop-share");
  assert.equal(life.economy!.cash, 680);
  assert.equal(life.economy!.assets["workshop-share"], 1);
  assert.equal(getAssetValue(engine.world, life), 120);
  assert.equal(getNetWorth(engine.world, life), netWorth);
  assert.throws(() => engine.act(life, "buy-tool-chest"), /major activity/);
  const purchased = life;
  life = engine.advance(life);
  assert.equal(life.economy!.cash - purchased.economy!.cash, 10);
  assert.equal(life.journal.filter(entry => entry.id === "asset-income").length, 1);
  assert.equal(engine.getActivities(life).find(activity => activity.id === "buy-workshop-share")!.available, false);
  const beforeSale = getNetWorth(engine.world, life);
  life = engine.act(life, "sell-workshop-share");
  assert.equal(life.economy!.cash, 810);
  assert.equal(life.economy!.assets["workshop-share"] ?? 0, 0);
  assert.equal(getAssetValue(engine.world, life), 0);
  assert.equal(getNetWorth(engine.world, life), beforeSale);
  const sold = life;
  life = engine.advance(life);
  assert.equal(life.economy!.cash, sold.economy!.cash, "Sold shares no longer produce income.");
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("the tool chest turns cash into a possession without creating unadvertised income", () => {
  const engine = createEngine(controlledWorld());
  let life = ageTo(engine, engine.start("tool-chest-ledger"), 18);
  life = engine.act(life, "buy-tool-chest");
  assert.equal(life.economy!.cash, 770);
  assert.equal(getAssetValue(engine.world, life), 30);
  assert.equal(getNetWorth(engine.world, life), 800);
  const next = engine.advance(life);
  assert.equal(next.economy!.cash, 770);
  assert.equal(next.character!.jobId, null, "A possession does not award an occupation.");
});

test("unpaid household costs can be repaid with the authored finance activity", () => {
  const world = controlledWorld();
  // This fixture exercises the optional manual-payment route specifically.
  world.economy!.autoDebtRepayment = false;
  world.yearlyRules = [
    { id: "large-bill", when: { type: "age", op: "eq", value: 18 }, effects: [{ type: "cash", delta: -810 }] },
    { id: "later-payment", when: { type: "age", op: "eq", value: 19 }, effects: [{ type: "cash", delta: 30 }] },
  ];
  const engine = createEngine(world);
  let life = ageTo(engine, engine.start("repay-household-costs"), 18);
  assert.equal(life.economy!.cash, 0);
  assert.equal(life.economy!.debt, 10);
  assert.equal(getNetWorth(world, life), -10);
  assert.equal(engine.getActivities(life).find(activity => activity.id === "repay-household-debt")!.available, false);
  life = ageTo(engine, life, 19);
  assert.equal(life.economy!.debt, 10, "Receiving cash does not silently repay debt.");
  const before = getNetWorth(world, life);
  life = engine.act(life, "repay-household-debt");
  assert.equal(life.economy!.cash, 20);
  assert.equal(life.economy!.debt, 0);
  assert.equal(getNetWorth(world, life), before);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("complete shipped-world lives retain nonnegative ledger balances and exact saves", () => {
  const engine = createEngine(pack);
  for (let index = 0; index < 24; index++) {
    let life = engine.start(`economy-complete-${index}`);
    for (let step = 0; step < 600 && life.phase !== "ended"; step++) {
      assert.ok(life.economy!.cash >= 0 && Number.isSafeInteger(life.economy!.cash));
      assert.ok(life.economy!.debt >= 0 && Number.isSafeInteger(life.economy!.debt));
      const available = engine.getActivities(life).filter(activity => activity.available);
      const finance = available.find(activity => activity.id === (index % 2 ? "buy-workshop-share" : "buy-tool-chest"));
      life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id)
        : finance ? engine.act(life, finance.id) : engine.advance(life);
    }
    assert.equal(life.phase, "ended");
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("the economy content generator reproduces the checked-in pack exactly", () => {
  const path = new URL("../worlds/alexandria-sample.json", import.meta.url);
  const before = readFileSync(path, "utf8");
  execFileSync(process.execPath, [fileURLToPath(new URL("../scripts/build-alexandria-world.mjs", import.meta.url))], { encoding: "utf8" });
  assert.equal(readFileSync(path, "utf8"), before);
});
