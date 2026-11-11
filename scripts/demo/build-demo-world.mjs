// Builds worlds/demo/alexandria-demo-1.json from the ranked world and src/demo content. Reproducible.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildDemoWorld } from "../../src/demo/world.ts";
import { validateWorld } from "../../src/validate.ts";

const root = new URL("../../", import.meta.url);
const ranked = JSON.parse(readFileSync(new URL("worlds/ranked/alexandria-ranked-1.json", root), "utf8"));
const world = buildDemoWorld(ranked);
validateWorld(world);
mkdirSync(new URL("worlds/demo/", root), { recursive: true });
writeFileSync(new URL(`worlds/demo/${world.version}.json`, root), `${JSON.stringify(world, null, 2)}\n`);
console.log(`Wrote worlds/demo/${world.version}.json (${world.events.length} events, ${world.character.jobs.length} jobs).`);
