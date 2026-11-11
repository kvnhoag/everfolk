import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import { builtinEngine, selectWorldPack } from "../client/lib/world-session.ts";
import { createDifferentSampleLife, createSampleLife } from "../client/mutations/lives.ts";
import type { WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };

// Load the real JSX components in Node; styles have no effect on server rendering.
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: BirthRollPopover } = await import("../client/components/BirthRollPopover.tsx");
const { default: App } = await import("../client/screens/App.tsx");
hooks.deregister();

for (const revealed of [false, true]) test(`opening a birth popup auto-rolls with saved reveal=${revealed}`, () => {
  const world = pack as WorldPack, engine = createEngine(world), life = engine.start("reopened-birth-roll");
  const saved = engine.save(life), before = JSON.stringify(life);
  let completions = 0, starts = 0, rebirths = 0;
  const props = { life, world, revealed, onReveal: () => { completions++; }, onContinue: () => { starts++; }, onReborn: () => { rebirths++; }, onClose() {} };
  const render = (open: boolean) => renderToStaticMarkup(createElement(BirthRollPopover, { ...props, open }));
  const first = render(true);
  assert.match(first, /aria-busy="true"/);
  assert.match(first, /Rolling starting stats/);
  assert.match(first, /Skip animation/);
  assert.match(first, /<button(?=[^>]*class="birth-popover-continue")(?=[^>]*disabled="")[^>]*>/);
  assert.match(first, /<button class="birth-popover-reborn"[^>]*>.*Reborn<\/button>/);
  assert.doesNotMatch(first, /<button(?=[^>]*class="birth-popover-reborn")(?=[^>]*disabled=)[^>]*>/, "a player can reroll without waiting for the animation");
  assert.doesNotMatch(first, /data-final-value=/);
  assert.doesNotMatch(first, />Roll starting stats</);
  assert.equal(render(false), "");
  const reopened = render(true);
  assert.match(reopened, /aria-busy="true"/, "closing and reopening starts a fresh presentation");
  assert.doesNotMatch(reopened, /data-final-value=/);
  assert.equal(completions, 0, "opening alone cannot complete the roll");
  assert.equal(starts, 0, "opening alone cannot begin the life");
  assert.equal(rebirths, 0, "opening alone cannot discard the current birth");
  assert.equal(JSON.stringify(life), before);
  assert.equal(engine.save(life), saved, "cosmetic replay cannot regenerate the saved birth or advance RNG");
});

test("the player app exposes Reborn in its starting popup", () => {
  const html = renderToStaticMarkup(createElement(App, { startFresh: true }));
  assert.match(html, /class="birth-popover-reborn"/);
  assert.match(html, /Roll a new name, background and starting stats/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /<button(?=[^>]*class="birth-popover-continue")(?=[^>]*disabled="")[^>]*>/);
});

test("fresh birth rerolls replace the identity and stats and automatically start a new reveal", () => {
  selectWorldPack(builtinEngine.world);
  let life = createSampleLife("birth-popup-before-reborn"), draw = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const saved = builtinEngine.save(life);
    const fresh = createDifferentSampleLife(life, () => `birth-popup-after-reborn-${++draw}`);
    assert.notEqual(fresh.seed, life.seed);
    assert.notEqual(fresh.character!.name, life.character!.name);
    assert.notEqual(fresh.originId, life.originId);
    assert.notDeepEqual(fresh.stats, life.stats);
    assert.equal(fresh.worldFingerprint, life.worldFingerprint);
    assert.equal(fresh.age, 0);
    assert.deepEqual(fresh.commands, []);
    assert.deepEqual(builtinEngine.load(builtinEngine.save(fresh)), fresh);
    assert.equal(builtinEngine.save(life), saved);
    const html = renderToStaticMarkup(createElement(BirthRollPopover, { open: true, life: fresh, world: builtinEngine.world, revealed: false,
      onReveal() {}, onContinue() {}, onClose() {}, onReborn() {},
    }));
    assert.match(html, /aria-busy="true"/);
    assert.doesNotMatch(html, /data-final-value=/);
    assert.match(html, /<button(?=[^>]*class="birth-popover-continue")(?=[^>]*disabled="")[^>]*>/);
    life = fresh;
  }
});
