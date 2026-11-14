import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: LifeEndingBanner } = await import("../client/components/LifeEndingBanner.tsx");
const { earnedPackCardCount } = await import("../chain/earned-cards.ts");
const { createFreePlayBooster } = await import("../client/models/freeplay-booster.ts");
const { packMilestone } = await import("../client/models/pack-milestones.ts");
const { figureFixture } = await import("./helpers/figure-path-fixture.ts");

test("the ending banner leads a free life to a preview pack, Weave Mode and the Market", () => {
  const html = renderToStaticMarkup(createElement(LifeEndingBanner, { name: "Herais", dates: "338 BCE – 274 BCE", lived: "64 years", cause: "Sepsis", ranked: false, packCards: 3, onChronicle() {}, onOpenPack() {}, onNewLife() {} }));
  assert.match(html, /LIFE COMPLETE/);
  assert.match(html, /You could have gotten 3 cards/);
  assert.match(html, /Preview pack · 3 cards/);
  assert.doesNotMatch(html, /Open your pack/);
  assert.match(html, /Play Weave Mode to get real NFTs/);
  assert.match(html, /href="#weave"/);
  assert.match(html, /href="#market"/);
  assert.doesNotMatch(html, /[Mm]int this/);
});

test("a free life with zero earned cards never offers Open your pack and explains Cards are earned", () => {
  const html = renderToStaticMarkup(createElement(LifeEndingBanner, { name: "Herais", dates: "x", lived: "45 years", ranked: false, packCards: 0, onChronicle() {}, onOpenPack() {}, onNewLife() {} }));
  assert.doesNotMatch(html, /Open your pack|Preview pack/);
  assert.match(html, /No pack this time/);
  assert.match(html, /Cards are earned, not drawn/);
  assert.match(html, /Play Weave Mode to get real NFTs/);
  assert.match(html, /href="#weave"/);
});

test("a Weave life's ending sends minting back to Weave Mode instead of a free pack", () => {
  const html = renderToStaticMarkup(createElement(LifeEndingBanner, { name: "Herais", dates: "x", lived: "64 years", ranked: true, packCards: 0, onChronicle() {}, onOpenPack() {}, onNewLife() {} }));
  assert.doesNotMatch(html, /Open your pack|Preview pack|Begin another life/);
  assert.match(html, /href="#market"/);
});

test("age milestones, life-end banner and free-play pack opening agree for zero-earned and earned lives", async () => {
  for (const age of [18, 40, 60]) assert.equal(packMilestone(age, false, { earnedOnly: true }), null);

  const emptyRun = figureFixture("ending-consistency-none");
  emptyRun.advanceTo(45);
  const emptyLife = { ...emptyRun.life, phase: "ended" as const };
  const emptyCount = earnedPackCardCount(emptyRun.world, emptyLife);
  const emptyBooster = await createFreePlayBooster(emptyLife, emptyRun.world);
  assert.equal(emptyCount, 0);
  assert.equal(emptyBooster.pack.cards.length, 0);
  const emptyHtml = renderToStaticMarkup(createElement(LifeEndingBanner, {
    name: "Herais", dates: "338 BCE – 293 BCE", lived: "45 years", ranked: false, packCards: emptyCount,
    onChronicle() {}, onOpenPack() {}, onNewLife() {},
  }));
  assert.doesNotMatch(emptyHtml, /Open your pack|Preview pack/);
  assert.match(emptyHtml, /No pack this time/);

  const earnedRun = figureFixture("ending-consistency-euclid");
  earnedRun.researchMastery();
  const path = earnedRun.path("euclid");
  earnedRun.advanceTo(50);
  earnedRun.yearly(path.encounter.activityId);
  earnedRun.contribute(path);
  earnedRun.completeCapstone(path);
  const earnedLife = { ...earnedRun.life, phase: "ended" as const, character: { ...earnedRun.life.character!, sex: "female" as const } };
  const earnedCount = earnedPackCardCount(earnedRun.world, earnedLife);
  const earnedBooster = await createFreePlayBooster(earnedLife, earnedRun.world);
  assert.equal(earnedCount, earnedBooster.pack.cards.length);
  assert.equal(earnedCount, 2);
  const earnedHtml = renderToStaticMarkup(createElement(LifeEndingBanner, {
    name: "Herais", dates: "338 BCE – 288 BCE", lived: "50 years", ranked: false, packCards: earnedCount,
    onChronicle() {}, onOpenPack() {}, onNewLife() {},
  }));
  assert.match(earnedHtml, /You could have gotten 2 cards/);
  assert.match(earnedHtml, /Preview pack · 2 cards/);
  assert.match(earnedHtml, /Play Weave Mode to get real NFTs/);
});
