import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createEngine } from "../src/engine.ts";
import { contentFingerprint } from "../src/random.ts";
import { capabilityCatalog } from "../src/capabilities/attribute-catalog.ts";
import retained from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import current from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };

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
