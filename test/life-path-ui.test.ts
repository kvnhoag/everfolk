import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };
import { visibleCharacterSections } from "../client/models/character-panel-model.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: LifePathPanel } = await import("../client/components/LifePathPanel.tsx");
hooks.deregister();

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);

function adultInScarceDistrict(): LifeState {
  let life = engine.start("life-path-ui");
  for (let guard = 0; life.age < 20 && life.phase !== "ended" && guard < 600; guard++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  const copy = structuredClone(life);
  copy.paths!.needs = { ...copy.paths!.needs, research: { bps: 16_000, label: "scarce" } };
  return copy;
}

test("the Life path tab appears only in worlds with life paths", () => {
  const life = adultInScarceDistrict();
  assert.ok(visibleCharacterSections(life, world, false).some(section => section.id === "path" && section.label === "Life path"));
  const plain = retained as unknown as WorldPack;
  assert.ok(!visibleCharacterSections(createEngine(plain).start("plain"), plain, false).some(section => section.id === "path"));
});

test("the panel names the stage, the district, scarce trades with their pay, and the pull toward a field", () => {
  const html = renderToStaticMarkup(createElement(LifePathPanel, { life: adultInScarceDistrict(), world }));
  assert.match(html, /Adulthood/);
  assert.match(html, /a Delta village|the garrison|the estate lands|the city quarter|the court quarter/);
  assert.match(html, /Research[^<]*<\/[^>]+>[\s\S]*?1\.6×/);
  assert.match(html, /Life stages/);
});
