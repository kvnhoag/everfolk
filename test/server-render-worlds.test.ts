import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// The dev worker (and the deployed Worker) renders pages on the server. World packs are multi-megabyte
// JSON; pulling them into a page's server render exhausted the dev worker's heap, so pages that play the
// game load it in the browser only. This walks static imports (dynamic import() is excluded) from each page.
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm;
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  return EXTENSIONS.map(ext => base + ext).find(path => existsSync(path) && !path.endsWith("/")) ?? null;
}

function worldImportsReachedFrom(entry: string): string[] {
  const seen = new Set<string>(), worlds: string[] = [], queue = [resolve(entry)];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith(".json")) { if (file.includes("/worlds/")) worlds.push(file); continue; }
    if (!/\.tsx?$/.test(file)) continue;
    for (const match of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const next = resolveImport(file, match[1] ?? match[2]);
      if (next) queue.push(next);
    }
  }
  return worlds;
}

for (const page of ["app/page.tsx", "app/npc/page.tsx", "app/skills/page.tsx", "app/test/weave/page.tsx", "app/test/weave/[feature]/page.tsx", "app/test/legacy/page.tsx"]) {
  test(`${page} does not load world packs during server rendering`, () => {
    assert.deepEqual(worldImportsReachedFrom(page), []);
  });
}

test("the wiki renders on the server from the current world alone", () => {
  const worlds = worldImportsReachedFrom("app/wiki/page.tsx");
  assert.deepEqual(worlds, [], "the wiki loads its one world with a dynamic import, not the whole world registry");
});
