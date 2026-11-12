import { readFile, writeFile } from "node:fs/promises";
import { buildFigurePathWorld } from "../../src/figures/world.ts";
import { validateWorld } from "../../src/validate.ts";
for (const baseName of ["alexandria-deep-1", "alexandria-lives-5"]) {
  const base = JSON.parse(await readFile(new URL(`../../worlds/demo/${baseName}.json`, import.meta.url), "utf8"));
  const world = buildFigurePathWorld(base);
  validateWorld(world);
  await writeFile(new URL(`../../worlds/demo/${world.version}.json`, import.meta.url), JSON.stringify(world, null, 2) + "\n");
  console.log(`Built ${world.version}: ${world.figurePaths.length} figure paths`);
}
