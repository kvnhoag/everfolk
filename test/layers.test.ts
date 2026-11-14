import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), "utf8");

/** The named layers in client/styles/layers.css, by name. */
function scale(): Map<string, number> {
  const layers = new Map<string, number>();
  for (const match of read("client/styles/layers.css").matchAll(/--ef-layer-([a-z-]+)\s*:\s*(-?\d+)/g)) layers.set(match[1], Number(match[2]));
  return layers;
}

/** Every `selector{declarations}` block of a stylesheet, with comments removed. */
function rules(css: string): { selector: string; body: string }[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }));
}

function cssFiles(directory: string): string[] {
  return readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(`${relative}/`) : relative.endsWith(".css") ? [relative] : [];
  });
}

test("one stacking order: header menus open above the pinned time bar, below the tutorial and full-screen layers", () => {
  const layer = scale();
  const order = ["raised", "dropdown", "time-bar", "header", "spotlight", "callout", "toast", "overlay"];
  for (const name of order) assert.ok(layer.has(name), `--ef-layer-${name} is defined`);
  for (let index = 1; index < order.length; index++) {
    assert.ok(layer.get(order[index - 1])! < layer.get(order[index])!, `${order[index - 1]} sits below ${order[index]}`);
  }
});

test("the root layout loads the layer scale for every page", () => {
  assert.match(read("app/layout.tsx"), /import "\.\.\/client\/styles\/layers\.css";/);
});

test("the game header forms its own layer above the time bar, so the sound drawer is never cut by it", () => {
  const css = rules(read("client/styles/gameplay-layout.css"));
  const bar = css.find(rule => rule.selector === ".everfolk-game .page-shell .life-session-bar");
  assert.match(bar?.body ?? "", /z-index:var\(--ef-layer-time-bar\)/);
  const header = css.find(rule => rule.selector === ".everfolk-game .site-header");
  assert.match(header?.body ?? "", /position:relative/);
  assert.match(header?.body ?? "", /z-index:var\(--ef-layer-header\)/);
});

test("the sound player and its drawer use the shared scale, not their own numbers", () => {
  const zIndexes = [...read("client/styles/audio-player.css").matchAll(/z-index:\s*([^;}]+)/g)].map(match => match[1].trim());
  assert.ok(zIndexes.length > 0);
  for (const value of zIndexes) assert.match(value, /^var\(--ef-layer-[a-z-]+\)$/);
});

test("page-level layers (fixed, sticky or 20 and up) take their z-index from the scale", () => {
  const offenders: string[] = [];
  for (const file of [...cssFiles("client/styles/"), ...cssFiles("client/demo/"), ...cssFiles("client/chain/"), ...cssFiles("client/homepage/")]) {
    // The scale itself, and the content studio, which is its own page and never shown with the game.
    if (file.endsWith("layers.css") || file.endsWith("admin.css")) continue;
    for (const { selector, body } of rules(read(file))) {
      const raw = body.match(/z-index:\s*(-?\d+)/);
      if (!raw) continue;
      const value = Number(raw[1]);
      const pinned = /position:\s*(?:fixed|sticky)/.test(body);
      if (value >= 20 || pinned && value > 2) offenders.push(`${file}: ${selector} {z-index:${value}}`);
    }
  }
  assert.deepEqual(offenders, []);
});
