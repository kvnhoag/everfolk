import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { plantingCheck } from "../client/models/planting-check.ts";
import { cropChoices, MIX_LOCKED_NOTE, mixedCurrentNote, pendingLine, plantedLine, splitText } from "../client/models/field-plan.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { PlantingTask } = await import("../client/demo/PlantingTask.tsx");
const { demoScreen } = await import("../client/demo/screen.ts");
const { writePlanDraft } = await import("../client/hooks/usePlanDraft.ts");
hooks.deregister();

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const engine = createEngine(world);

function liveTo(seed: string, age: number): LifeState {
  let life: LifeState = engine.start(seed);
  for (let step = 0; step < 300 && !(life.age >= age && life.phase === "ready") && life.phase !== "ended"; step++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  assert.notEqual(life.phase, "ended", "the life reaches the age under test");
  return life;
}

function card(life: LifeState, lockedUntil: number | null = null) {
  const screen = demoScreen(world, life)!;
  const html = renderToStaticMarkup(createElement(PlantingTask, { screen, onPlan: () => null, checkPlan: (flax: number) => plantingCheck(engine, life, flax), lockedUntil }));
  return { html, screen };
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("before Crop allocation the card offers only All grain and All flax, the current plan selected", () => {
  const life = liveTo("plant-card", 13);
  assert.equal(life.demo!.household.flaxPlots, 0);
  const { html, screen } = card(life);
  const words = text(html);
  assert.match(words, /All grain/);
  assert.match(words, /All flax/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
  assert.match(html, /<label class="aoe-crop-choice is-selected"><input type="radio" name="[^"]+" checked="" value="grain"\/>/, "All grain is the plan in effect");
  assert.match(words, /All grain Current plan/);
  assert.match(words, /Food for the household and the rent\. Needs 20 grain as seed\./);
  assert.match(words, /Fibre to spin into linen and sell\. Needs 4 flax seed; you have none\./);
  assert.ok(words.includes(MIX_LOCKED_NOTE));
  assert.doesNotMatch(html, /aoe-stepper/, "no counter, so no mixed plan to refuse");
  assert.doesNotMatch(words, /Learn Crop allocation/);
  assert.ok(words.includes(`Planted for next harvest: 2 grain plots, about ${screen.household.expectedHarvest} measures of grain.`), words);
  assert.doesNotMatch(html, />Set planting</, "the two big choices plant at once, so no choice is ever left unset");
});

test("after choosing All flax the card shows it selected as the plan in effect, with the game's forecast", () => {
  const before = liveTo("plant-card", 13);
  const seeded = structuredClone(before);
  seeded.vocations!.inventory["flax-seed"] = 4;
  const life = engine.demo(seeded, { type: "plan", flaxPlots: 2 });
  const { html, screen } = card(life);
  const words = text(html);
  assert.match(html, /<label class="aoe-crop-choice is-selected"><input type="radio" name="[^"]+" checked="" value="flax"\/>/);
  assert.match(words, /All flax Current plan/);
  assert.ok(screen.household.expectedFlax > 0, "seeded flax plots bring flax");
  assert.ok(words.includes(`Planted for next harvest: 2 flax plots, about ${screen.household.expectedFlax} bundles of flax.`), words);
});

function withCropAllocation(life: LifeState): LifeState {
  const copy = structuredClone(life);
  copy.capabilities!.learned.FC8 = { age: copy.age, year: copy.year };
  return copy;
}

test("after Crop allocation the counter comes back and the mix note goes", () => {
  const { html } = card(withCropAllocation(liveTo("plant-card", 13)));
  assert.match(html, /aoe-stepper/);
  assert.doesNotMatch(html, /type="radio"/);
  assert.ok(!text(html).includes(MIX_LOCKED_NOTE));
  assert.match(text(html), /2 grain · 0 flax Current plan/);
  assert.match(html, /<button type="button" class="aoe-task-primary" disabled="">Set planting<\/button>/, "nothing to set until the split changes");
});

test("an unsaved split survives the card closing and opening again, and stays visible until it is set", () => {
  const life = withCropAllocation(liveTo("plant-card", 13));
  writePlanDraft({ plots: 2, current: 0, flax: 1 });
  try {
    const { html } = card(life);
    const words = text(html);
    assert.match(words, /1 grain · 1 flax/);
    assert.match(words, /Current plan: 2 grain plots\./);
    assert.ok(words.includes("Not set yet: press Set planting to plant 1 grain plot and 1 flax plot for the next harvest."), words);
    assert.match(html, /<button type="button" class="aoe-task-primary">Set planting<\/button>/);
    writePlanDraft({ plots: 2, current: 2, flax: 1 });
    assert.match(text(card(life).html), /2 grain · 0 flax Current plan/, "a draft made for another plan is not shown");
  } finally { writePlanDraft(null); }
});

test("trapped in all flax with no seed and no money: All grain is one click away and the card says to take it", () => {
  const start = liveTo("plant-trap", 20);
  const life = structuredClone(engine.demo(start, { type: "plan", flaxPlots: start.demo!.household.plots }));
  life.economy!.cash = 0;
  life.vocations!.inventory["flax-seed"] = 0;
  const { html } = card(life);
  const words = text(html);
  assert.match(html, /<label class="aoe-crop-choice is-selected"><input type="radio" name="[^"]+" checked="" value="flax"\/>/, "the inherited plan shows as selected");
  assert.match(html, /<label class="aoe-crop-choice"><input type="radio" name="[^"]+" value="grain"\/>/, "All grain is offered and enabled");
  assert.ok(words.includes("No flax seed and no money to buy it: switch to All grain so these fields feed the household."), words);
  assert.doesNotMatch(words, /Learn Crop allocation|Use − and \+/);
  assert.doesNotMatch(html, />Set planting</, "choosing All grain plants it at once");
});

test("the card stays locked while the family plans the fields", () => {
  const { html } = card(liveTo("plant-card", 2), 4);
  assert.match(text(html), /Unlocks at age 4/);
  assert.doesNotMatch(html, />Set planting</);
});

test("field plan words read in plain, grammatical English", () => {
  assert.equal(splitText(2, 0), "2 grain plots");
  assert.equal(splitText(1, 1), "1 grain plot and 1 flax plot");
  assert.equal(splitText(0, 3), "3 flax plots");
  assert.equal(plantedLine(2, 0, { grainPlots: 2, flaxPlots: 0, grain: 180, flax: 0 }), "Planted for next harvest: 2 grain plots, about 180 measures of grain.");
  assert.equal(plantedLine(1, 1, { grainPlots: 1, flaxPlots: 1, grain: 90, flax: 1 }), "Planted for next harvest: 1 grain plot and 1 flax plot, about 90 measures of grain and about 1 bundle of flax.");
  assert.equal(plantedLine(0, 2, { grainPlots: 2, flaxPlots: 0, grain: 150, flax: 0 }), "Planted for next harvest: 2 grain plots, about 150 measures of grain.", "what is really sown");
  assert.equal(plantedLine(2, 0, null), "Planted for next harvest: 2 grain plots.");
  assert.equal(plantedLine(2, 0, { grainPlots: 2, flaxPlots: 0, grain: 0, flax: 0 }), "Planted for next harvest: 2 grain plots, but no harvest is expected.");
  assert.equal(pendingLine(0, 2), "Not set yet: press Set planting to plant 2 flax plots for the next harvest.");
  assert.equal(mixedCurrentNote(1, 1), "Your fields are planned as 1 grain plot and 1 flax plot. Choose All grain or All flax to change the plan.");
  const [grain, flax] = cropChoices(2, null, null);
  assert.equal(grain.line, "Food for the household and the rent.");
  assert.equal(flax.line, "Fibre to spin into linen and sell.");
  assert.equal(flax.flaxPlots, 2);
});
