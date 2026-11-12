import { readFile, writeFile } from "node:fs/promises";
import { buildFigurePathWorld } from "../../src/figures/world.ts";
import { validateWorld } from "../../src/validate.ts";
const base = JSON.parse(await readFile(new URL("../../worlds/demo/alexandria-lives-3.json", import.meta.url), "utf8"));
const world = buildFigurePathWorld(base);
validateWorld(world);
await writeFile(new URL(`../../worlds/demo/${world.version}.json`, import.meta.url), JSON.stringify(world, null, 2) + "\n");
console.log(`Built ${world.version}: ${world.figurePaths.length} figures, ${Object.keys(world.vocations.actions).length} work/shop actions, ${world.events.length} events`);
