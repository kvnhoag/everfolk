import { readFile, writeFile } from "node:fs/promises";
import { buildContributionTierWorld } from "../../src/figures/contribution-world.ts";
import { buildCommonContributionWorld } from "../../src/figures/common-contribution-world.ts";
import { validateWorld } from "../../src/validate.ts";

const archiveName = version => ({ "alexandria-lives-7": "alexandria-lives-7-wsl-contributions", "alexandria-lives-8": "alexandria-lives-8-wsl-contributions" }[version] ?? version);

for (const baseName of ["alexandria-lives-6", "alexandria-figures-1"]) {
  const base = JSON.parse(await readFile(new URL(`../../worlds/demo/${baseName}.json`, import.meta.url), "utf8"));
  const world = buildContributionTierWorld(base);
  validateWorld(world);
  await writeFile(new URL(`../../worlds/demo/${archiveName(world.version)}.json`, import.meta.url), JSON.stringify(world, null, 2) + "\n");
  console.log(`Built ${world.version}: ${world.figurePaths.length} figure paths with contribution tiers below the principal`);
}

for (const baseName of ["alexandria-lives-7-wsl-contributions", "alexandria-figures-2"]) {
  const base = JSON.parse(await readFile(new URL(`../../worlds/demo/${baseName}.json`, import.meta.url), "utf8"));
  const world = buildCommonContributionWorld(base);
  validateWorld(world);
  await writeFile(new URL(`../../worlds/demo/${archiveName(world.version)}.json`, import.meta.url), JSON.stringify(world, null, 2) + "\n");
  console.log(`Built ${world.version}: fixed Legendary contribution ladders begin at Common`);
}
