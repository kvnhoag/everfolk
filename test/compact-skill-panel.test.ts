import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: CompactSkillPanel } = await import("../client/CompactSkillPanel.tsx");
hooks.deregister();

test("the infant sidebar keeps the wiki accessible without locked skills or an empty branch selector", () => {
  const world = pack as WorldPack, life = createEngine(world).start("compact-wiki-infant");
  const before = structuredClone(life);
  const html = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, onOpenWiki: () => {} }));
  assert.match(html, />Skill wiki /);
  assert.match(html, /No skills unlocked yet/);
  assert.doesNotMatch(html, /compact-skill-node|<select|<meter|Full tree/);
  assert.deepEqual(life, before);
});

test("the sidebar offers only visible branches and preserves the older tree callback", () => {
  const world = pack as WorldPack, engine = createEngine(world), life = structuredClone(engine.start("compact-wiki-current"));
  life.age = 6;
  const html = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, activities: engine.getActivities(life), onOpenTree: () => {} }));
  assert.match(html, />Skill wiki /);
  assert.match(html, /<select/);
  assert.match(html, /<option value="Letters &amp; ideas"/);
  assert.doesNotMatch(html, /<option value="Performance"|compact-skill-node is-locked|Full tree/);
});
