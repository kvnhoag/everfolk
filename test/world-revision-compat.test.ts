import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createEngine } from "../src/engine.ts";
import { contentFingerprint } from "../src/random.ts";
import { capabilityCatalog } from "../src/capabilities/attribute-catalog.ts";
import retained from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import current from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };
import figuresOnFive from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import lives7 from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import newest from "../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { marketView } from "../src/demo/market.ts";
import { decidesScope } from "../src/life-stages/index.ts";
import type { LifeStateWithDemo, TradeCommand } from "../src/demo/contracts.ts";
import { liveUntil } from "./fixtures/demo/world.ts";
import type { WorldPack } from "../src/types.ts";
import { runWoodworkerPolicy } from "./work-proof-policy.ts";

test("lives-4 keeps its exact published pack and prerequisite graph", () => {
  assert.equal(contentFingerprint(retained), "fnv1a64-9bcc9879dbab8caa");
  assert.equal(retained.capabilities.version, 2);
  assert.deepEqual(capabilityCatalog(2).find(node => node.id === "M8")!.prerequisites.all, ["M7", "P4"]);
  assert.equal(current.version, "alexandria-lives-5");
  assert.equal(current.capabilities.version, 3);
  assert.deepEqual(capabilityCatalog(3).find(node => node.id === "M8")!.prerequisites.all, ["M7", "P2"]);
  assert.doesNotThrow(() => createEngine(current));
});

// Recorded by the original engine and pack at main d5228e4, choosing the first offered answer.
for (const [seed, hash] of [
  ["retained-four-0", "fnv1a64-af4ad36127a0c775"],
  ["retained-four-1", "fnv1a64-bc9ecb95c245d094"],
  ["retained-four-2", "fnv1a64-e2d9631446341e9d"],
]) test(seed + " preserves the previously published state and replay", () => {
  const engine = createEngine(retained);
  let life = engine.start(seed);
  while (life.age < 40 && life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  assert.equal(contentFingerprint(life), hash);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("an exported lives-4 save opens in a clean registry without prior selection", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import {createEngine} from './src/engine.ts';
    import {loadAnyLife, sampleEngine} from './client/lib/world-session.ts';
    import pack from './worlds/demo/alexandria-lives-4.json' with {type:'json'};
    const before = sampleEngine;
    const engine = createEngine(pack);
    let life = engine.start('clean-retained-four');
    for (let step=0; step<30 && life.phase!=='ended'; step++) life = life.phase==='choice' ? engine.choose(life,engine.getChoices(life)[0].id) : engine.advance(life);
    assert.deepEqual(loadAnyLife(engine.save(life)), life);
    assert.equal(sampleEngine, before);
    console.log('retained-four-import-ok');
  `], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.match(output, /retained-four-import-ok/);
});

test("lives-5 keeps its exact published pack after later revisions opt in to proof from work", () => {
  assert.equal(contentFingerprint(current), "fnv1a64-6bdfd18d0a847c3f");
  assert.equal("proofFromWork" in current.capabilities, false);
  assert.equal(figuresOnFive.version, "alexandria-lives-6");
  assert.equal("proofFromWork" in figuresOnFive.capabilities, false, "the figure paths on lives-5 keep the lives-5 rules");
  assert.equal(newest.version, "alexandria-lives-8");
  assert.equal(newest.capabilities.version, 3);
  assert.equal(newest.capabilities.proofFromWork, true);
  assert.doesNotThrow(() => createEngine(newest as unknown as WorldPack));
});

// Recorded by the lives-5 engine and pack before proof from work, at feat/skills-from-work 196c9f4.
for (const [seed, hash] of [
  ["retained-five-0", "fnv1a64-342395e667528190"],
  ["retained-five-1", "fnv1a64-d666f90ecfeddddb"],
  ["retained-five-2", "fnv1a64-0905d9ea804fd9f6"],
]) test(seed + " preserves the lives-5 state and replay", () => {
  const engine = createEngine(current as unknown as WorldPack);
  let life = engine.start(seed);
  while (life.age < 40 && life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  assert.equal(contentFingerprint(life), hash);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

// A lives-5 woodworker who practises and works every year: still no skills, exactly as recorded before.
for (const [seed, hash] of [
  ["woodworker-0", "fnv1a64-e151ea156b7cf357"],
  ["woodworker-1", "fnv1a64-507452d919ee3f42"],
  ["woodworker-2", "fnv1a64-d64528fcf1422b84"],
]) test("lives-5 " + seed + " replays without proof from work", () => {
  const life = runWoodworkerPolicy(current as unknown as WorldPack, seed, 22);
  assert.equal(contentFingerprint(life), hash);
  assert.deepEqual(life.capabilities!.learned, {});
  const engine = createEngine(current as unknown as WorldPack);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("an exported lives-5 save opens in a clean registry after the later bumps", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import {createEngine} from './src/engine.ts';
    import {loadAnyLife, sampleEngine} from './client/lib/world-session.ts';
    import {loadLifeWorld} from './client/chain/life-world.ts';
    import pack from './worlds/demo/alexandria-lives-5.json' with {type:'json'};
    const before = sampleEngine;
    const engine = createEngine(pack);
    let life = engine.start('clean-retained-five');
    for (let step=0; step<30 && life.phase!=='ended'; step++) life = life.phase==='choice' ? engine.choose(life,engine.getChoices(life)[0].id) : engine.advance(life);
    assert.deepEqual(loadAnyLife(engine.save(life)), life);
    assert.equal(sampleEngine, before);
    assert.equal((await loadLifeWorld('alexandria-lives-5')).version, 'alexandria-lives-5');
    assert.equal((await loadLifeWorld('alexandria-lives-6')).version, 'alexandria-lives-6');
    console.log('retained-five-import-ok');
  `], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.match(output, /retained-five-import-ok/);
});

test("lives-7 keeps its exact published pack after lives-8 adds the figure paths", () => {
  const bytes = readFileSync(new URL("../worlds/demo/alexandria-lives-7.json", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "66c261281bf93b3a0bf948897e9f87e72207a8140e4635295d853dd24c82ee4b");
  assert.equal(contentFingerprint(lives7), "fnv1a64-116f320d17a4bed2");
  assert.equal(lives7.version, "alexandria-lives-7");
  assert.equal("figurePaths" in lives7, false);
  assert.equal(newest.demo.market.minTradeAge, 10);
  assert.equal(newest.capabilities.proofFromWork, true);
  assert.equal(newest.figurePaths.length, 11);
  assert.equal(figuresOnFive.demo.market.minTradeAge, 12);
});

// Recorded by the lives-7 engine and pack before the lives-8 figure paths, at chore/deploy c93d2af.
for (const [seed, hash] of [
  ["retained-seven-0", "fnv1a64-b12c7d0b3b255490"],
  ["retained-seven-1", "fnv1a64-d8c685a267282d89"],
  ["retained-seven-2", "fnv1a64-94f8b7762f3a2697"],
]) test(seed + " preserves the lives-7 state and replay", () => {
  const engine = createEngine(lives7 as unknown as WorldPack);
  let life = engine.start(seed);
  while (life.age < 40 && life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  assert.equal(contentFingerprint(life), hash);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

// A lives-7 woodworker learns from work exactly as recorded at c93d2af.
for (const [seed, hash] of [
  ["woodworker-0", "fnv1a64-161fefd503165676"],
  ["woodworker-1", "fnv1a64-9083c521798fe909"],
  ["woodworker-2", "fnv1a64-9b07e17a3bd56904"],
]) test("lives-7 " + seed + " replays its proof from work", () => {
  const life = runWoodworkerPolicy(lives7 as unknown as WorldPack, seed, 22);
  assert.equal(contentFingerprint(life), hash);
  const engine = createEngine(lives7 as unknown as WorldPack);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("an exported lives-7 save opens in a clean registry after the lives-8 bump", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import {createEngine} from './src/engine.ts';
    import {loadAnyLife, sampleEngine} from './client/lib/world-session.ts';
    import {loadLifeWorld} from './client/chain/life-world.ts';
    import pack from './worlds/demo/alexandria-lives-7.json' with {type:'json'};
    const before = sampleEngine;
    const engine = createEngine(pack);
    let life = engine.start('clean-retained-seven');
    for (let step=0; step<30 && life.phase!=='ended'; step++) life = life.phase==='choice' ? engine.choose(life,engine.getChoices(life)[0].id) : engine.advance(life);
    assert.deepEqual(loadAnyLife(engine.save(life)), life);
    assert.equal(sampleEngine, before);
    assert.equal((await loadLifeWorld('alexandria-lives-6')).version, 'alexandria-lives-6');
    assert.equal((await loadLifeWorld('alexandria-lives-7')).version, 'alexandria-lives-7');
    assert.equal((await loadLifeWorld('alexandria-lives-8')).version, 'alexandria-lives-8');
    console.log('retained-seven-import-ok');
  `], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.match(output, /retained-seven-import-ok/);
});

const BUY_ONE_GRAIN: TradeCommand = { type: "trade", item: "grain", side: "buy", quantity: 1, counterparty: "merchant" };
/** A life of the world in the ready phase at exactly this age, reached through the real engine. */
function readyAt(world: WorldPack, age: number) {
  const engine = createEngine(world);
  const life = liveUntil(engine, "market-age", state => state.age >= age && state.phase === "ready");
  assert.equal(life.age, age);
  assert.equal(life.phase, "ready");
  return { engine, life: life as LifeStateWithDemo };
}

test("lives-7 and lives-8 lives trade at the grain market from age 10; lives-6 still refuses until 12", () => {
  const seven = lives7 as unknown as WorldPack, six = figuresOnFive as unknown as WorldPack;
  const eight = readyAt(newest as unknown as WorldPack, 10);
  assert.equal(eight.engine.demo(eight.life, BUY_ONE_GRAIN).demo!.lastTradeAge, 10);
  const young = readyAt(seven, 10);
  assert.deepEqual(marketView(seven.demo!, young.life).reasons, []);
  const traded = young.engine.demo(young.life, BUY_ONE_GRAIN);
  assert.equal(traded.demo!.lastTradeAge, 10);
  assert.equal(traded.demo!.household.grain, young.life.demo.household.grain + 1);
  // The market is the child's own errand: the household scope (shared purchases, NPC grain offers) still opens at 16.
  assert.equal(decidesScope(seven, "household", 10), false);
  const younger = readyAt(seven, 9);
  assert.throws(() => younger.engine.demo(younger.life, BUY_ONE_GRAIN), /too young to trade at the market \(from age 10\)/);
  const retained = readyAt(six, 10);
  assert.deepEqual(marketView(six.demo!, retained.life).reasons, ["You are too young to trade at the market (from age 12)."]);
  assert.throws(() => retained.engine.demo(retained.life, BUY_ONE_GRAIN), /too young to trade at the market \(from age 12\)/);
});
