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
const { default: WikiLibrary } = await import("../client/WikiLibrary.tsx");
hooks.deregister();

test("the sidebar offers a collapsed Your skills disclosure without unearned skills", () => {
  const world = pack as WorldPack, life = createEngine(world).start("compact-infant");
  const before = structuredClone(life);
  const html = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life }));
  assert.match(html, /<details class="compact-skill-disclosure">/);
  assert.match(html, /Your skills/);
  assert.doesNotMatch(html, /is-unlearned/);
  assert.match(html, /No skills learned in this life yet/);
  assert.doesNotMatch(html, /Skill wiki|<select|<details[^>]+ open/);
  assert.equal((html.match(/class="compact-skill-node /g) ?? []).length, 0);
  assert.deepEqual(life, before);
});

test("earned progress stays colored while zero-value skills remain unlearned", () => {
  const world = pack as WorldPack, life = structuredClone(createEngine(world).start("compact-earned"));
  life.age = 16;
  life.character!.skills.literacy = 20;
  const html = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life }));
  assert.match(html, /compact-skill-node is-learning"[^>]+title="Literacy/);
  assert.doesNotMatch(html, /is-unlearned/);
  assert.doesNotMatch(html, /Performance/);
  assert.doesNotMatch(html, /Skill wiki/);
});

test("wiki retains the full reference catalog without performing actions", () => {
 const world=pack as WorldPack;
 const html=renderToStaticMarkup(createElement(WikiLibrary,{world,onSkills(){}}));
 assert.match(html,/Occupations/);assert.match(html,/Accomplishments &amp; titles/);assert.match(html,/Events &amp; decisions/);
 for(const job of world.character!.jobs)assert.ok(html.includes(renderToStaticMarkup(createElement('h4',null,job.title))));
});
