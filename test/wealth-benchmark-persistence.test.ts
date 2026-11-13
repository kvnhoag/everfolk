import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { getAssetValue } from "../src/economy.ts";
import { engineForLife, WEALTH_OBSERVATIONS_KEY } from "../client/lib/world-session.ts";
import {
  clearRecordedWealthObservations,
  getRecordedWealthObservations,
  getSocietyWealthBenchmarkInfo,
  MIN_RECORDED_LIVES,
  recordedLifeIdentity,
} from "../client/models/society-wealth-data.ts";
import { getWealthSummary } from "../client/models/wealth.ts";
import { archiveLife, createSampleLife, restoreWealthObservations, syncLifeWealthObservation } from "../client/mutations/lives.ts";
import { readWealthObservations } from "../client/queries/lives.ts";
import type { StorageLike } from "../client/types/session.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) {
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
          fileName: new URL(url).pathname,
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
const { default: WealthPanel } = await import("../client/components/WealthPanel.tsx");
hooks.deregister();

function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
}

function withEconomyWealth(life: LifeState, cash: number): LifeState {
  assert.ok(life.economy, "expected economy state");
  return {
    ...life,
    economy: {
      ...life.economy,
      cash,
      assets: [],
      holdings: {},
    },
  };
}

const noop = () => {};

function advanceSampleLife(seed: string): { world: WorldPack; initial: LifeState; midway: LifeState; ended: LifeState } {
  let life = createSampleLife(seed);
  const engine = engineForLife(life);
  const initial = life;
  let midway: LifeState | null = null;
  for (let step = 0; step < 1500; step++) {
    if (life.phase === "ended") {
      return { world: engine.world, initial, midway: midway ?? life, ended: life };
    }
    if (life.phase === "choice") {
      const choice = engine.getChoices(life)[0];
      assert.ok(choice, "expected at least one choice");
      life = engine.choose(life, choice.id);
    } else {
      life = engine.advance(life);
    }
    if (!midway && life.age >= 18) midway = life;
  }
  assert.fail("sample life did not reach ended within safety bound");
}

function observedAssets(world: WorldPack, life: LifeState): number {
  assert.ok(life.economy, "expected economy state");
  return Math.round(life.economy.cash + getAssetValue(world, life));
}

test("Issue #2: live progression deduplicates by life identity, avoids archive double-counting, and survives reload", () => {
  clearRecordedWealthObservations();
  try {
    const storage = createMemoryStorage();
    const { world, initial, midway, ended } = advanceSampleLife("wealth-persistence-real-life");

    syncLifeWealthObservation(storage, initial);
    assert.deepEqual(getRecordedWealthObservations(world.id, world.version), [observedAssets(world, initial)]);

    syncLifeWealthObservation(storage, midway);
    assert.deepEqual(getRecordedWealthObservations(world.id, world.version), [observedAssets(world, midway)]);

    syncLifeWealthObservation(storage, ended);
    assert.deepEqual(getRecordedWealthObservations(world.id, world.version), [observedAssets(world, ended)]);

    archiveLife(storage, ended);
    assert.deepEqual(getRecordedWealthObservations(world.id, world.version), [observedAssets(world, ended)]);

    const stored = readWealthObservations(storage);
    const revKey = `${world.id}::${world.version}`;
    assert.equal(stored[revKey]?.[recordedLifeIdentity(ended)], observedAssets(world, ended));

    clearRecordedWealthObservations();
    assert.equal(getRecordedWealthObservations(world.id, world.version).length, 0);

    restoreWealthObservations(storage);
    assert.deepEqual(getRecordedWealthObservations(world.id, world.version), [observedAssets(world, ended)]);

    // Seed 18 more lives into storage and ensure syncing the 20th merges persisted entries without clobbering them.
    for (let i = 1; i <= MIN_RECORDED_LIVES - 2; i++) {
      syncLifeWealthObservation(storage, withEconomyWealth(createSampleLife(`910100-${i}`), 100 + i * 10));
    }
    assert.equal(getRecordedWealthObservations(world.id, world.version).length, MIN_RECORDED_LIVES - 1);

    clearRecordedWealthObservations();
    syncLifeWealthObservation(storage, withEconomyWealth(createSampleLife("919999"), 999));
    assert.equal(getRecordedWealthObservations(world.id, world.version).length, MIN_RECORDED_LIVES);
  } finally {
    clearRecordedWealthObservations();
  }
});

test("Issue #2: WealthPanel and benchmark metadata accurately reflect fallback, recorded-life threshold, and world revisions", () => {
  clearRecordedWealthObservations();
  try {
    const storage = createMemoryStorage();
    const probe = withEconomyWealth(createSampleLife("920000"), 250);
    const world = engineForLife(probe).world;

    for (let i = 0; i < 5; i++) {
      syncLifeWealthObservation(storage, withEconomyWealth(createSampleLife(`920001-${i}`), 100 + i * 25));
    }

    const fallbackInfo = getSocietyWealthBenchmarkInfo(world);
    assert.equal(fallbackInfo.kind, "authored-households");
    assert.match(fallbackInfo.description, /starting household distributions/i);
    assert.match(fallbackInfo.description, /5 of 20 recorded lives/);

    const fallbackHtml = renderToStaticMarkup(createElement(WealthPanel, {
      life: probe,
      world,
      activities: [],
      onActivity: noop,
      onMarketOrder: noop,
      onCancelMarketOrder: noop,
    }));
    assert.match(fallbackHtml, /Median household wealth/);
    assert.match(fallbackHtml, /Game estimate/);
    assert.match(fallbackHtml, /5 of 20 recorded lives/);
    assert.doesNotMatch(fallbackHtml, /Recorded-lives estimate/);

    for (let i = 5; i < MIN_RECORDED_LIVES; i++) {
      syncLifeWealthObservation(storage, withEconomyWealth(createSampleLife(`920001-${i}`), 100 + i * 25));
    }

    clearRecordedWealthObservations();
    restoreWealthObservations(storage);

    const summary = getWealthSummary(world, probe);
    assert.equal(summary.benchmark.kind, "recorded-lives");
    assert.equal(summary.benchmark.sampleCount, MIN_RECORDED_LIVES);
    assert.match(summary.benchmark.description, new RegExp(`${MIN_RECORDED_LIVES} recorded player lives`));
    assert.ok(summary.benchmark.description.includes(world.version));

    const recordedHtml = renderToStaticMarkup(createElement(WealthPanel, {
      life: probe,
      world,
      activities: [],
      onActivity: noop,
      onMarketOrder: noop,
      onCancelMarketOrder: noop,
    }));
    assert.match(recordedHtml, /Median recorded wealth/);
    assert.match(recordedHtml, new RegExp(`Recorded-lives estimate \\(${MIN_RECORDED_LIVES}\\)`));
    assert.match(recordedHtml, new RegExp(`${MIN_RECORDED_LIVES} recorded player lives`));
    assert.match(recordedHtml, /Updates as lives progress and complete/);
    assert.doesNotMatch(recordedHtml, /starting households/i);
    assert.doesNotMatch(recordedHtml, /stays the same as your life advances/i);

    const nextRevision: WorldPack = { ...world, version: `${world.version}-next` };
    const nextInfo = getSocietyWealthBenchmarkInfo(nextRevision);
    assert.equal(nextInfo.kind, "authored-households");
    assert.match(nextInfo.description, /0 of 20 recorded lives/);
  } finally {
    clearRecordedWealthObservations();
  }
});

test("Issue #2: readWealthObservations safely ignores corrupt or malformed storage payloads", () => {
  const storage = createMemoryStorage();
  storage.setItem(WEALTH_OBSERVATIONS_KEY, "{not-valid-json");
  assert.deepEqual(readWealthObservations(storage), {});

  storage.setItem(WEALTH_OBSERVATIONS_KEY, JSON.stringify([{ bad: true }]));
  assert.deepEqual(readWealthObservations(storage), {});

  storage.setItem(WEALTH_OBSERVATIONS_KEY, JSON.stringify({
    "alexandria::1.0.0": { valid: 420.6, broken: "NaN", infinite: null },
  }));
  assert.deepEqual(readWealthObservations(storage), {
    "alexandria::1.0.0": { valid: 421 },
  });
});
