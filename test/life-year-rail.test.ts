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
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: LifeYearRail } = await import("../client/components/LifeYearRail.tsx");
hooks.deregister();

const HELP_BADGE = /<span class="section-help[^"]*"><button[^>]*>\?<\/button><span[^>]*role="tooltip"[^>]*>[^<]*<\/span><\/span>/;

/** The rail itself has no controls; its only button is the tutorial's "?" help badge, removed here. */
function render(age: number, birthYear = -350) {
  const life = { age, year: yearAtAge(birthYear, age) } as LifeState;
  const html = renderToStaticMarkup(createElement(LifeYearRail, { life }));
  assert.match(html, HELP_BADGE, "the rail has a ? help badge");
  return html.replace(HELP_BADGE, "");
}

test("the birth rail starts in the actual birth year and marks future decades without clickable controls", () => {
  const html = render(0);
  assert.match(html, /Birth 350 BCE · Age 0/);
  assert.match(html, /Current year 350 BCE, age 0/);
  assert.match(html, /Age 0, 350 BCE/);
  assert.doesNotMatch(html, /<button|life-year-stop-mark|Open chronicle/);
  assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
});

test("a growing life exposes completed decades and tracks the exact current year", () => {
  const html = render(23);
  assert.match(html, /Birth 350 BCE · Age 23/);
  assert.match(html, /Current year 327 BCE, age 23/);
  assert.match(html, /Age 20, 330 BCE/);
  assert.match(html, /aria-label="Age 30, 320 BCE, not yet lived"/);
  assert.doesNotMatch(html, /<button|life-year-stop-mark/);
});

test("BCE to CE lifetimes skip year zero and retain the correct birth year", () => {
  const html = render(23, -10);
  assert.match(html, /Birth 10 BCE · Age 23/);
  assert.match(html, /Current year 14 CE, age 23/);
  assert.match(html, /Age 10, 1 CE/);
  assert.match(html, /Age 20, 11 CE/);
  assert.doesNotMatch(html, /\b0 (?:BCE|CE)\b/);
});

test("lifetimes beyond ninety extend the rail to the next decade", () => {
  const html = render(94);
  assert.match(html, /Age 100, 250 BCE, not yet lived/);
  assert.doesNotMatch(html, /<button/);
});
