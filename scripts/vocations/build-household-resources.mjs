import { readFile, writeFile } from "node:fs/promises";
import { buildHouseholdResourceWorld } from "../../src/vocations/household-resource-world.ts";
import { buildHistoryHouseholdWorld } from "../../src/vocations/history-household-world.ts";
import { validateWorld } from "../../src/validate.ts";

const base = JSON.parse(await readFile(new URL("../../worlds/demo/alexandria-lives-8-wsl-contributions.json", import.meta.url), "utf8"));
const write = async world => writeFile(new URL(`../../worlds/demo/${world.version}.json`, import.meta.url), JSON.stringify(world, null, 2) + "\n");
// Retained (alexandria-lives-10): it must stay byte-identical so its saves replay.
const world = buildHouseholdResourceWorld(base);
validateWorld(world);
await write(world);
console.log(`Built ${world.version}: modest ordinary starts, larger merchant and aristocratic reserves`);
// Current births (alexandria-lives-11): lives-10 born across 400–300 BCE, likelier where history happens.
const born = buildHistoryHouseholdWorld(world);
validateWorld(born);
await write(born);
console.log(`Built ${born.version}: births ${born.birthYears.from} to ${born.birthYears.to} on ${world.version}`);
