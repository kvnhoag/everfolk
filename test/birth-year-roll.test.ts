import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import { BIRTH_ROLL_DURATION_MS, getBirthDigitReels, getBirthRollYear } from "../client/models/birth-stat-roll.ts";

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

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "birth-year", version: "1", title: "Birth year", description: "A year reveal fixture.",
    startYear: -350, birthYears: { from: -350, to: -300 }, maxAge: 80,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 70 } }, flags: {},
    origins: [{ id: "home", title: "A household", text: "A home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
  };
}

test("the birth-year reel lands on the engine's recorded year without changing RNG or replay", () => {
  const engine = createEngine(fixture()), years = new Set<number>();
  for (let index = 0; index < 24; index++) {
    const life = engine.start(`birth-year-${index}`), saved = engine.save(life), year = getBirthRollYear(engine.world, life);
    years.add(life.birthYear!);
    assert.ok(life.birthYear! >= -350 && life.birthYear! <= -300);
    assert.equal(year.value, Math.abs(life.birthYear!));
    assert.equal(year.text, `${year.value} BCE`);
    assert.deepEqual(year.range, { min: 300, max: 350 });
    assert.equal(year.rangeLabel, "350 BCE – 300 BCE");
    const reels = getBirthDigitReels(year, life.seed, BIRTH_ROLL_DURATION_MS, 0, 2);
    assert.equal(reels.map(reel => reel.finalDigit).join(""), String(year.value));
    assert.equal(engine.save(life), saved);
    assert.deepEqual(engine.load(saved), life);
  }
  assert.ok(years.size > 1, "new seeds roll different birth years");
});

test("fixed historical starts and Common Era years preserve the correct calendar label", () => {
  const world = fixture(); delete world.birthYears;
  let engine = createEngine(world), life = engine.start("fixed-year");
  assert.equal(getBirthRollYear(engine.world, life).text, "350 BCE");
  world.startYear = 120;
  engine = createEngine(world); life = engine.start("fixed-ce-year");
  assert.equal(getBirthRollYear(engine.world, life).era, "CE");
  assert.equal(getBirthRollYear(engine.world, life).text, "120 CE");
});

test("the starting reveal animates birth year, hides the result during rolling and announces it when settled", () => {
  const engine = createEngine(fixture()), life = engine.start("birth-year-ui"), before = engine.save(life);
  const render = (revealed: boolean) => renderToStaticMarkup(createElement(BirthStatRoll, { world: engine.world, life, revealed, onComplete() {} }));
  const rolling = render(false);
  assert.match(rolling, /BIRTH YEAR/);
  assert.match(rolling, /birth-roll-year is-rolling/);
  assert.match(rolling, /Final year hidden/);
  assert.doesNotMatch(rolling, /data-final-value=/);
  const settled = render(true);
  assert.match(settled, /birth-roll-year is-settled/);
  assert.match(settled, /350 BCE – 300 BCE/);
  assert.ok(settled.includes(`Born in ${Math.abs(life.birthYear!)} BCE.`));
  assert.equal(engine.save(life), before);
});
