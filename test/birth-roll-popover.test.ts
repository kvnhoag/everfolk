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

// Load the real JSX components in Node; styles have no effect on server rendering.
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: BirthRollPopover } = await import("../client/BirthRollPopover.tsx");
hooks.deregister();

for (const revealed of [false, true]) test(`opening a birth popup auto-rolls with saved reveal=${revealed}`, () => {
  const world = pack as WorldPack, engine = createEngine(world), life = engine.start("reopened-birth-roll");
  const saved = engine.save(life), before = JSON.stringify(life);
  let completions = 0, starts = 0;
  const props = { life, world, revealed, onReveal: () => { completions++; }, onContinue: () => { starts++; }, onClose() {} };
  const render = (open: boolean) => renderToStaticMarkup(createElement(BirthRollPopover, { ...props, open }));
  const first = render(true);
  assert.match(first, /aria-busy="true"/);
  assert.match(first, /Rolling starting stats/);
  assert.match(first, /Skip animation/);
  assert.match(first, /<button(?=[^>]*class="birth-popover-continue")(?=[^>]*disabled="")[^>]*>/);
  assert.doesNotMatch(first, /data-final-value=/);
  assert.doesNotMatch(first, />Roll starting stats</);
  assert.equal(render(false), "");
  const reopened = render(true);
  assert.match(reopened, /aria-busy="true"/, "closing and reopening starts a fresh presentation");
  assert.doesNotMatch(reopened, /data-final-value=/);
  assert.equal(completions, 0, "opening alone cannot complete the roll");
  assert.equal(starts, 0, "opening alone cannot begin the life");
  assert.equal(JSON.stringify(life), before);
  assert.equal(engine.save(life), saved, "cosmetic replay cannot regenerate the saved birth or advance RNG");
});
