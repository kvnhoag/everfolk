import { readFile, writeFile } from "node:fs/promises";
import { buildResourceBalanceWorld } from "../../src/vocations/resource-balance-world.ts";
import { validateWorld } from "../../src/validate.ts";

const base = JSON.parse(await readFile(new URL("../../worlds/demo/alexandria-lives-8-wsl-contributions.json", import.meta.url), "utf8"));
const world = buildResourceBalanceWorld(base);
validateWorld(world);
await writeFile(new URL(`../../worlds/demo/alexandria-lives-9-wsl-resources.json`, import.meta.url), JSON.stringify(world, null, 2) + "\n");
console.log(`Built ${world.version}: smaller starting reserves and proportional crop flows`);
