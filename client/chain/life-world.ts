import { LIVES_WORLD_VERSION } from "../../src/vocations/ids.ts";
import currentLife from "../../worlds/demo/alexandria-lives-10.json" with { type: "json" };
import life9 from "../../worlds/demo/alexandria-lives-9.json" with { type: "json" };
import life8 from "../../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import life7 from "../../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import life6 from "../../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import life5 from "../../worlds/demo/alexandria-lives-5.json" with { type: "json" };
import life4 from "../../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import life3 from "../../worlds/demo/alexandria-lives-3.json" with { type: "json" };
import life2 from "../../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import life1 from "../../worlds/demo/alexandria-lives-1.json" with { type: "json" };
import deep1 from "../../worlds/demo/alexandria-deep-1.json" with { type: "json" };
import figures3 from "../../worlds/demo/alexandria-figures-3.json" with { type: "json" };
import figures2 from "../../worlds/demo/alexandria-figures-2.json" with { type: "json" };
import figures1 from "../../worlds/demo/alexandria-figures-1.json" with { type: "json" };
import type { WorldPack } from "../../src/types.ts";
import { DEMO_WORLD_VERSION, LEGACY_DEMO_WORLD_VERSION, NPC_WORLD_VERSION, RANKED_WORLD_VERSION } from "../../chain/ids.ts";
import { ensureDemoDeeds } from "../../chain/catalog/demo-deeds.ts";
import { buildNpcWorld } from "../../chain/npc-world.ts";
import currentDemo from "../../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import legacyDemo from "../../worlds/demo/alexandria-demo-1.json" with { type: "json" };
import ranked from "../../worlds/ranked/alexandria-ranked-1.json" with { type: "json" };
/** Resolve the exact revision recorded in the life; never replace retained packs. */
export async function loadLifeWorld(version: string): Promise<WorldPack> {
  if (version === NPC_WORLD_VERSION) return buildNpcWorld(life8 as unknown as WorldPack);
  const packs: Record<string, unknown> = {
    [LIVES_WORLD_VERSION]: currentLife,
    "alexandria-lives-9": life9,
    "alexandria-lives-8": life8,
    "alexandria-lives-7": life7, "alexandria-lives-6": life6, "alexandria-lives-5": life5, "alexandria-lives-4": life4, "alexandria-lives-3": life3,
    "alexandria-lives-2": life2, "alexandria-lives-1": life1,
    "alexandria-deep-1": deep1, "alexandria-figures-1": figures1, "alexandria-figures-2": figures2, "alexandria-figures-3": figures3,
    [DEMO_WORLD_VERSION]: currentDemo, [LEGACY_DEMO_WORLD_VERSION]: legacyDemo, [RANKED_WORLD_VERSION]: ranked,
  };
  if (!Object.hasOwn(packs, version)) throw new Error(`Unknown life world: ${version}`);
  return ensureDemoDeeds(packs[version] as WorldPack);
}
