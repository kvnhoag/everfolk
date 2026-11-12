import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { RESOURCE_IDS, RESOURCES, resourceIcon } from "../client/demo/resources.ts";
import { TRADE_ITEMS } from "../src/demo/types.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: PixelIcon, iconCells } = await import("../client/components/PixelIcon.tsx");
hooks.deregister();

const SKILL_ICONS = ["heart", "book", "coin", "people", "hourglass", "arrow", "check", "pause", "play", "close", "download", "restart", "pin", "feather", "ship", "home", "sun", "sculpture", "craft", "pottery", "carving", "literacy", "oratory", "philosophy", "reckoning", "astrology", "military", "commerce", "astronomy-calendar", "music-performance"];

test("every resource has its own 7x9 bitmap", () => {
  for (const id of RESOURCE_IDS) {
    const cells = iconCells(resourceIcon(id));
    assert.ok(cells, id);
    assert.equal(cells.length, 7, id);
    for (const row of cells) assert.match(row, /^[#.]{9}$/, id);
    const html = renderToStaticMarkup(createElement(PixelIcon, { name: resourceIcon(id) }));
    assert.ok((html.match(/<rect/g) ?? []).length >= 6, id);
  }
});

test("resource icons are all different", () => {
  const joined = RESOURCE_IDS.map((id) => iconCells(resourceIcon(id))?.join("/"));
  assert.equal(new Set(joined).size, 11);
  const skills = new Set(SKILL_ICONS.map((name) => iconCells(name)?.join("/")));
  for (const bitmap of joined) assert.ok(!skills.has(bitmap));
});

test("PixelIcon with label renders an accessible title", () => {
  const html = renderToStaticMarkup(createElement(PixelIcon, { name: "res-grain", label: "Grain" }));
  assert.match(html, /role="img"/);
  assert.match(html, /<title/);
});

test("resourceIcon maps every TradeItem and labels are set", () => {
  for (const item of TRADE_ITEMS) assert.equal(resourceIcon(item), `res-${item}`);
  assert.equal(RESOURCES.silk.label, "Coan silk");
  assert.equal(RESOURCES.drachmas.icon, "res-drachmas");
  assert.equal(RESOURCE_IDS.length, 11);
});
