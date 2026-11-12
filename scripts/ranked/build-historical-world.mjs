// Prepare corrected history as a new revision; never rewrite a recorded ranked-1 pack.
import { readFileSync, writeFileSync } from "node:fs";
import { correctHistoricalInfluences } from "../../chain/catalog/historical-content.ts";
import { createEngine } from "../../src/engine.ts";

const root = new URL("../../", import.meta.url);
const legacy = JSON.parse(readFileSync(new URL("worlds/ranked/alexandria-ranked-1.json", root), "utf8"));
const world = { ...legacy, version: "ranked-2", influences: correctHistoricalInfluences(legacy.influences) };
const { fingerprint } = createEngine(world);
writeFileSync(new URL("worlds/ranked/alexandria-ranked-2.json", root), `${JSON.stringify(world, null, 2)}\n`);
console.log(`Prepared ${world.id}-${world.version} (${fingerprint}). Existing ranked-1 lives keep their original pack.`);
