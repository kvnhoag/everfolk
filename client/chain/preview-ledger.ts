import { sha256Hex } from "../../chain/hash.ts";
import { RANKED_WORLD_VERSION } from "../../chain/ids.ts";
import type { Evidence } from "../../chain/types.ts";
import { createMockContract, type MockLivesContract } from "./mock-contract.ts";

/**
 * A small practice ledger for the ranked screens while the live service is not configured:
 * a few owners, one finished and minted life, earnings waiting to be claimed and two listings.
 * The player is `player.testnet`. Nothing here touches NEAR.
 */

export const PREVIEW_ACCOUNT = "player.testnet";
const NEAR = 10n ** 24n;

function seedOwners(ledger: MockLivesContract): void {
  ledger.seedToken({ owner_id: PREVIEW_ACCOUNT, kind: "figure", figure_id: "euclid", action_id: "euclid.school", rarity: 2, affection: 64 });
  ledger.seedToken({ owner_id: "alice.testnet", kind: "figure", figure_id: "aristotle", action_id: "aristotle.lyceum", rarity: 3, affection: 48 });
  ledger.seedToken({ owner_id: "genesis.testnet", kind: "figure", figure_id: "alexander", action_id: "alexander.found", rarity: 2, affection: 40 });
  ledger.seedToken({ owner_id: "genesis.testnet", kind: "figure", figure_id: "cleomenes", action_id: "cleomenes.granaries", rarity: 4, affection: 55 });
  ledger.seedToken({ owner_id: "alice.testnet", kind: "npc", career_group: "letters", action_id: "letters.teach", rarity: 1, affection: 70 });
  ledger.seedToken({ owner_id: "bob.testnet", kind: "npc", career_group: "military", rarity: 0, affection: 35 });
  ledger.seedToken({ owner_id: "genesis.testnet", kind: "npc", career_group: "commerce", rarity: 0, affection: 30 });
  ledger.seedToken({ owner_id: "genesis.testnet", kind: "npc", career_group: "craft", rarity: 2, affection: 42 });
  ledger.seedToken({ owner_id: PREVIEW_ACCOUNT, kind: "npc", career_group: "sky", action_id: "sky.omen", rarity: 1, affection: 58 });
  ledger.seedToken({ owner_id: "genesis.testnet", kind: "npc", career_group: "performance", rarity: 0, affection: 25 });
}

/** Bob lives and mints one life shaped by Euclid and Aristotle, then offers it for sale. */
async function mintBobsLife(ledger: MockLivesContract): Promise<void> {
  const bob = ledger.as("bob.testnet");
  const life = await bob.startLife(RANKED_WORLD_VERSION);
  const evidence: Evidence = {
    v: 1, seed: life.seed, life_id: life.life_id, account_id: life.account_id, world_version: life.world_version,
    world_fingerprint: "preview", save_hash: await sha256Hex("preview-save"), stats: { bonds: 62 }, skills: { literacy: 48 },
    origin_id: "scribe-family", peak_job_id: "copyist", accomplishments: [], death_age: 61, birth_year: -350, death_year: -289,
    career_group: "letters", matched_figures: [],
    sources: life.figure_picks
      .filter(pick => pick.figure_id === "euclid" || pick.figure_id === "aristotle")
      .map(pick => ({ token_id: pick.token_id, impact: pick.figure_id === "euclid" ? 75_000 : 60_000 })),
  };
  const evidence_json = JSON.stringify(evidence);
  const minted = await bob.mintLife(life.life_id, {
    evidence, evidence_json, evidence_hash: await sha256Hex(evidence_json), signature: "0".repeat(128), verifier_kind: "server-signer",
  }, "letters.teach");
  await bob.list(minted.token_id, (2n * NEAR).toString());
}

export async function createPreviewLedger(): Promise<MockLivesContract> {
  const ledger = createMockContract({ genesis: false, accountId: PREVIEW_ACCOUNT, abandonCooldownMs: 0 });
  seedOwners(ledger);
  await mintBobsLife(ledger);
  await ledger.as("alice.testnet").list("2", ((25n * NEAR) / 2n).toString());
  return ledger;
}
