// Writes the ranked world (base pack + influence catalog) and the contract's CatalogConfig.
// Usage: pnpm ranked:world
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildContractCatalog, buildRankedWorld } from "../../chain/ranked-world.ts";
import { createEngine } from "../../src/engine.ts";

const root = new URL("../../", import.meta.url);
const base = JSON.parse(readFileSync(new URL("worlds/alexandria-0.33.0.json", root), "utf8"));
const world = buildRankedWorld(base);
// createEngine validates the pack, including the influence catalog, before anything is written.
const { fingerprint } = createEngine(world);

const worldFile = new URL("worlds/ranked/alexandria-ranked-1.json", root);
mkdirSync(new URL("./", worldFile), { recursive: true });
writeFileSync(worldFile, `${JSON.stringify(world, null, 2)}\n`);
writeFileSync(new URL("chain/catalog/contract-catalog.json", root), `${JSON.stringify(buildContractCatalog(process.env.FIGURE_MEDIA_BASE_URL), null, 2)}\n`);
console.log(`Wrote ${world.id}-${world.version} (${fingerprint}) and the contract catalog.`);
