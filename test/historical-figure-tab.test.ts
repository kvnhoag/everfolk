import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/engine.ts";
import type { WorldPack } from "../src/types.ts";
import current from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: CharacterPanel } = await import("../client/components/CharacterPanel.tsx");
const { default: SkillTree } = await import("../client/components/SkillTree.tsx");
hooks.deregister();
const world = current as unknown as WorldPack;
const engine = createEngine(world), life = engine.start("historical-figure-tab");
const noop = () => {};
function render(section: "skills" | "figures", pack = world) {
  const state = pack === world ? life : createEngine(pack).start("old-figure-tab");
  return renderToStaticMarkup(createElement(CharacterPanel, { world: pack, life: state, initialSection: section, onActivity: noop, onMarketOrder: noop, onCancelMarketOrder: noop }));
}

test("skills offer a separate historical figures tab without mounting figure paths beneath the tree", () => {
  const before = JSON.stringify(life);
  const html = render("skills");
  assert.match(html, /role="tab"[^>]*-tab-figures" aria-selected="false"[^>]*>Historical Figures/);
  assert.match(html, /role="tabpanel"[^>]*-panel-figures"[^>]*hidden=""/);
  assert.doesNotMatch(html, /data-figure-path=|class="figure-paths"/);
  assert.equal(JSON.stringify(life), before);
});

test("the historical figures tab opens its own associated panel containing all eleven paths", () => {
  const html = render("figures");
  const tab = html.match(/<button[^>]*role="tab"[^>]*id="([^"]+)-tab-figures"[^>]*>/);
  assert.ok(tab);
  assert.match(tab[0], /aria-selected="true"/);
  assert.ok(html.includes(`id="${tab[1]}-panel-figures" aria-labelledby="${tab[1]}-tab-figures" tabindex="0">`));
  assert.equal((html.match(/class="figure-paths"/g) ?? []).length, 1);
  const roster = html.match(/<nav class="figure-roster"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.equal((roster.match(/aria-pressed=/g) ?? []).length, 11);
  assert.match(html, /Resolve the decisive campaign operation/);
});

test("retained packs keep their old tabs and have no empty figure section", () => {
  const html = render("skills", retained as unknown as WorldPack);
  assert.doesNotMatch(html, /-tab-figures|-panel-figures|class="figure-paths"/);
});

test("the shared skill wiki no longer embeds historical figure development paths", () => {
  const html = renderToStaticMarkup(createElement(SkillTree, { world, life, activities: engine.getActivities(life), onActivity: noop, initialView: "wiki" }));
  assert.doesNotMatch(html, /class="figure-paths"|data-figure-path=/);
});
