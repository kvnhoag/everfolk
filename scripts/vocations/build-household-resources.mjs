import { readFile, writeFile } from "node:fs/promises";
import { buildHouseholdResourceWorld } from "../../src/vocations/household-resource-world.ts";
import { validateWorld } from "../../src/validate.ts";

const base = JSON.parse(await readFile(new URL("../../worlds/demo/alexandria-lives-8.json", import.meta.url), "utf8"));
const world = buildHouseholdResourceWorld(base);
validateWorld(world);
await writeFile(new URL(`../../worlds/demo/${world.version}.json`, import.meta.url), JSON.stringify(world, null, 2) + "\n");
console.log(`Built ${world.version}: modest ordinary starts, larger merchant and aristocratic reserves`);
