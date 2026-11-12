import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import { getAssetValue, getNetWorth } from "../src/economy.ts";
import type { WorldPack } from "../src/types.ts";
import { BIRTH_ROLL_DURATION_MS, getBirthDigitReels, getBirthRollResources, getBirthRollStats } from "../client/models/birth-stat-roll.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: BirthStatRoll } = await import("../client/components/BirthStatRoll.tsx");
hooks.deregister();

function resourceWorld(): WorldPack {
  return {
    schemaVersion: 1, id: "birth-resources", version: "1", title: "Household rolls", description: "A resource fixture.", startYear: -20, maxAge: 80,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 70 }, wealth: { label: "Resources", min: 0, max: 100, initial: 10, initialRange: { min: 10, max: 12 } } },
    flags: {}, origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [], assetRanges: { tools: { min: 2, max: 6 } } }],
    yearlyEffects: [], events: [], endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    economy: { stat: "wealth", unitsPerPoint: 10, uncappedResources: true, currency: { singular: "drachma", plural: "drachmas", short: "dr" }, description: "Authored market prices.", assets: [
      { id: "tools", title: "Tool chest", description: "Tools.", value: 30, maxOwned: 1, initialRange: { min: 0, max: 1 } },
      { id: "share", title: "Workshop share", description: "Shares.", value: 120, initialRange: { min: 0, max: 2 } },
      { id: "empty", title: "Empty stores", description: "Nothing held.", value: 5 },
    ] },
  };
}

test("the resource display uses origin overrides and current market value in the wealth roll", () => {
  const engine = createEngine(resourceWorld()), life = engine.start("rolled-resource-display"), before = engine.save(life);
  const resources = getBirthRollResources(engine.world, life);
  assert.deepEqual(resources.map(resource => resource.range), [{ min: 2, max: 6 }, { min: 0, max: 2 }, { min: 0, max: 0 }]);
  for (const [index, resource] of resources.entries()) {
    const asset = engine.world.economy!.assets[index];
    assert.equal(resource.value, life.economy!.assets[asset.id]);
    assert.equal(resource.unitPrice, asset.value);
    assert.equal(resource.marketValue, resource.value * asset.value);
    const landed = getBirthDigitReels(resource, life.seed, BIRTH_ROLL_DURATION_MS, 1, 2);
    assert.equal(Number(landed.map(reel => reel.glyphs[1]).join("")), resource.value);
  }
  const wealth = getBirthRollStats(engine.world, life).find(stat => stat.id === "wealth")!;
  assert.equal(wealth.value, life.economy!.cash + getAssetValue(engine.world, life));
  assert.equal(wealth.value, getNetWorth(engine.world, life));
  assert.deepEqual(wealth.range, { min: 160, max: 540 });
  assert.equal(engine.save(life), before, "the display neither rerolls resources nor advances RNG");
});

test("resource ranges are omitted after play and when a birth event changes a quantity", () => {
  const world = resourceWorld();
  world.events = [{ id: "birth-gift", title: "Gift", text: "An extra chest.", trigger: { type: "age", at: 0 }, mode: "automatic", effects: [{ type: "asset", asset: "tools", delta: 1 }], choices: [] }];
  const engine = createEngine(world), born = engine.start("resource-gift");
  const resources = getBirthRollResources(engine.world, born);
  assert.equal(resources[0].range, undefined);
  assert.deepEqual(resources[1].range, { min: 0, max: 2 });
  assert.equal(getBirthRollStats(engine.world, born).find(stat => stat.id === "wealth")!.range, undefined);
  const later = engine.advance(born);
  assert.ok(getBirthRollResources(engine.world, later).every(resource => resource.range === undefined));
  assert.deepEqual(getBirthRollResources({ ...world, economy: undefined }, later), []);
});

test("compact resource rows hide results while rolling and reveal quantities, value and accessible summary", () => {
  const engine = createEngine(resourceWorld()), life = engine.start("compact-resource-reveal"), before = engine.save(life);
  const render = (revealed: boolean, autoStart = true) => renderToStaticMarkup(createElement(BirthStatRoll, { life, world: engine.world, revealed, autoStart, onComplete() {} }));
  const rolling = render(false);
  assert.match(rolling, /birth-roll-resources is-rolling/);
  assert.match(rolling, /<h4>Starting resources<\/h4>/);
  assert.match(rolling, /30 dr each/);
  assert.match(rolling, /class="birth-resource-number"/);
  assert.doesNotMatch(rolling, /data-final-value=/);
  assert.doesNotMatch(rolling, /Resources: Tool chest/);
  assert.match(render(false, false), /birth-roll-resources is-waiting/);
  const revealed = render(true);
  assert.match(revealed, /birth-roll-resources is-settled/);
  assert.match(revealed, /Counted in total wealth/);
  assert.match(revealed, /Resources at market prices/);
  assert.ok(revealed.includes(`Tool chest ${life.economy!.assets.tools}, market value ${life.economy!.assets.tools * 30} dr`));
  assert.ok(revealed.includes(`<td>${getAssetValue(engine.world, life)} dr</td></tr></tfoot>`));
  assert.doesNotMatch(revealed, /Empty stores/);
  assert.equal(engine.save(life), before);
});
