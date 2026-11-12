import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createEngine } from "../src/engine.ts";
import { contentFingerprint } from "../src/random.ts";
import { capabilityCatalog } from "../src/capabilities/attribute-catalog.ts";
import retained from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import current from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };
import newest from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };
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

test("lives-5 keeps its exact published pack after lives-6 opts in to proof from work", () => {
  assert.equal(contentFingerprint(current), "fnv1a64-6bdfd18d0a847c3f");
  assert.equal("proofFromWork" in current.capabilities, false);
  assert.equal(newest.version, "alexandria-lives-6");
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

test("an exported lives-5 save opens in a clean registry after the lives-6 bump", () => {
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
