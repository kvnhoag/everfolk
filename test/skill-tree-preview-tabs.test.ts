import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: SkillTreePreview } = await import("../client/screens/SkillTreePreview.tsx");
hooks.deregister();

test("public skill reference defaults to its skill tab without mounting figure paths below it", () => {
  const html = renderToStaticMarkup(createElement(SkillTreePreview));
  assert.match(html, /role="tablist" aria-label="Reference sections"/);
  assert.match(html, /aria-selected="true" tabindex="0">Skill tree/);
  assert.match(html, /aria-selected="false" tabindex="-1">Historical Figures/);
  assert.match(html, /class="capability-tree(?: is-radial)?"/);
  assert.doesNotMatch(html, /class="figure-paths"|data-figure-path=/);
});

test("the historical reference has its own panel with eleven figures and read-only work", () => {
  const html = renderToStaticMarkup(createElement(SkillTreePreview, { initialTab: "figures" }));
  assert.match(html, /aria-selected="true" tabindex="0">Historical Figures/);
  assert.match(html, /<h1>Historical Figures<\/h1>/);
  assert.match(html, /class="figure-paths"/);
  assert.doesNotMatch(html, /class="capability-tree"/);
  const roster = html.match(/<nav class="figure-roster"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.equal((roster.match(/aria-pressed=/g) ?? []).length, 11);
  assert.match(html, /<button type="button" disabled="">Record this contribution title/);
  assert.doesNotMatch(html, /aria-label="Next earned upgrade"/);
});

test("each public tab controls its separately labelled reference panel", () => {
  const html = renderToStaticMarkup(createElement(SkillTreePreview));
  const tabs = [...html.matchAll(/role="tab" id="([^"]+)" aria-controls="([^"]+)"/g)];
  assert.equal(tabs.length, 2);
  for (const [, tabId, panelId] of tabs) assert.ok(html.includes(`role="tabpanel" id="${panelId}" aria-labelledby="${tabId}"`));
  assert.equal(new Set(tabs.map(match => match[2])).size, 2);
});
