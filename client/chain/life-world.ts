import type { WorldPack } from "../../src/types.ts";
import { DEMO_WORLD_VERSION, LEGACY_DEMO_WORLD_VERSION, RANKED_WORLD_VERSION } from "../../chain/ids.ts";
import { ensureDemoDeeds } from "../../chain/catalog/demo-deeds.ts";
import currentDemo from "../../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import legacyDemo from "../../worlds/demo/alexandria-demo-1.json" with { type: "json" };
import ranked from "../../worlds/ranked/alexandria-ranked-1.json" with { type: "json" };

/** Resolve the exact revision recorded in the life and its signed evidence. */
export async function loadLifeWorld(version: string): Promise<WorldPack> {
  const pack = version === DEMO_WORLD_VERSION
    ? currentDemo
    : version === LEGACY_DEMO_WORLD_VERSION
      ? legacyDemo
      : version === RANKED_WORLD_VERSION
        ? ranked
        : null;
  if (!pack) throw new Error(`Unknown life world: ${version}`);
  return ensureDemoDeeds(pack as unknown as WorldPack);
}
