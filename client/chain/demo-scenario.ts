import { DEMO_WORLD_VERSION } from "../../chain/ids.ts";
import { createMockContract, type MockLivesContract } from "./mock-contract.ts";

/** Practice account that already holds Life A's Farming NFT. */
export const DEMO_LIFE_A_OWNER = "life-a.demo.testnet";

/**
 * Prepared demo scenario for workflow 2.
 * Life C's seed is null until workflow 1 publishes the fixture; the ledger already holds Life A's deed.
 */
export const DEMO_SCENARIO = {
  worldVersion: DEMO_WORLD_VERSION,
  seed: null as string | null,
  lifeA: { owner: DEMO_LIFE_A_OWNER, careerGroup: "farming" as const, actionId: "farming.stock-granary" },
  comparison: "Replay the same commands with no harvest draw.",
};

/** A practice ledger with Life A's granary deed already minted. No wallet. */
export function createDemoScenarioLedger(accountId = "player.testnet"): MockLivesContract {
  const ledger = createMockContract({ genesis: false, nobodyWeightBps: 0, abandonCooldownMs: 0, accountId });
  ledger.seedToken({
    owner_id: DEMO_LIFE_A_OWNER,
    kind: "npc",
    career_group: "farming",
    action_id: "farming.stock-granary",
    rarity: 0,
    affection: 80,
  });
  return ledger;
}
