import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const worlds = fileURLToPath(new URL("../worlds/", import.meta.url));

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? jsonFiles(path) : name.endsWith(".json") ? [path] : [];
  });
}

test("every world pack has a WorldPack type file, so the type check never infers megabytes of JSON", async () => {
  const { worldTypeSource } = await import("../scripts/write-world-types.mjs") as { worldTypeSource(path: string): string };
  const missing = jsonFiles(worlds).filter(json => {
    const stub = json.replace(/\.json$/, ".d.json.ts");
    return !existsSync(stub) || readFileSync(stub, "utf8") !== worldTypeSource(json);
  });
  assert.deepEqual(missing, [], "run: node scripts/write-world-types.mjs");
  const tsconfig = JSON.parse(readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"));
  assert.equal(tsconfig.compilerOptions.allowArbitraryExtensions, true, "TypeScript only reads .d.json.ts files with allowArbitraryExtensions");
});
