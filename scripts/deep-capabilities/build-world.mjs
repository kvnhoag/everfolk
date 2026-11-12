import { readFile, writeFile } from "node:fs/promises";
import { buildDeepSkillWorld } from "../../src/deep-capabilities/world.ts";
import { validateWorld } from "../../src/validate.ts";
const base = JSON.parse(await readFile(new URL("../../worlds/demo/alexandria-lives-2.json", import.meta.url), "utf8"));
const world = buildDeepSkillWorld(base);
validateWorld(world);
await writeFile(new URL(`../../worlds/demo/${world.version}.json`, import.meta.url), JSON.stringify(world, null, 2) + "\n");
console.log(`Built ${world.version}: ${world.deepCapabilities.rules.length} deep capabilities`);
