import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { yearAtAge } from "../src/calendar.ts";
import type { LifeState } from "../src/types.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: LifeYearRail } = await import("../client/LifeYearRail.tsx");
hooks.deregister();

function render(age: number, birthYear = -350) {
  const life = { age, year: yearAtAge(birthYear, age) } as LifeState;
  return renderToStaticMarkup(createElement(LifeYearRail, { life, onOpenChronicle() {} }));
}

test("the birth rail starts in the actual birth year and keeps future decades disabled", () => {
  const html = render(0);
  assert.match(html, /Birth 350 BCE · Age 0/);
  assert.match(html, /Current year 350 BCE, age 0/);
  assert.match(html, /Open chronicle: age 0, 350 BCE/);
  assert.equal((html.match(/ disabled=""/g) ?? []).length, 9);
  assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
});

test("a growing life exposes completed decades and tracks the exact current year", () => {
  const html = render(23);
  assert.match(html, /Birth 350 BCE · Age 23/);
  assert.match(html, /Current year 327 BCE, age 23/);
  assert.match(html, /Open chronicle: age 20, 330 BCE/);
  assert.match(html, /disabled="" aria-label="Age 30, 320 BCE, not yet lived"/);
  assert.equal((html.match(/ disabled=""/g) ?? []).length, 7);
});

test("BCE to CE lifetimes skip year zero and retain the correct birth year", () => {
  const html = render(23, -10);
  assert.match(html, /Birth 10 BCE · Age 23/);
  assert.match(html, /Current year 14 CE, age 23/);
  assert.match(html, /Open chronicle: age 10, 1 CE/);
  assert.match(html, /Open chronicle: age 20, 11 CE/);
  assert.doesNotMatch(html, /\b0 (?:BCE|CE)\b/);
});

test("lifetimes beyond ninety extend the rail to the next decade", () => {
  const html = render(94);
  assert.match(html, /Age 100, 250 BCE, not yet lived/);
  assert.equal((html.match(/ disabled=""/g) ?? []).length, 1);
});
