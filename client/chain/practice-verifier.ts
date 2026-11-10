import { buildEvidence } from "../../chain/evidence.ts";
import { sha256Hex } from "../../chain/hash.ts";
import { checkRankedObligations } from "../../chain/ranked-rules.ts";
import type { LifeView } from "../../chain/types.ts";
import { validateRankedSave } from "../../chain/validate-ranked.ts";
import { createEngine } from "../../src/index.ts";
import { canonicalJson } from "../../src/random.ts";
import type { SaveFile, WorldPack } from "../../src/types.ts";
import type { LivesContract, SignedEvidence } from "./types.ts";

/** Practice ledger contract id; influences in practice lives name it as their source. */
export const PRACTICE_CONTRACT_ID = "preview.everfolk.testnet";

/**
 * For the in-browser practice ledger only: the same rules the server verifier enforces, with an all-zero
 * signature that no real contract accepts. Live play always verifies on the server.
 */
export function practiceVerifier(world: WorldPack, contract: LivesContract, contractId = PRACTICE_CONTRACT_ID) {
  const engine = createEngine(world);
  return async (life: LifeView, save: SaveFile): Promise<SignedEvidence> => {
    const current = (await contract.getLife(life.life_id)) ?? life;
    const check = await validateRankedSave(current, save, contractId);
    if (!check.ok) throw new Error(check.reason);
    const replay = checkRankedObligations(engine, current, save);
    if (!replay.ok) throw new Error(replay.reason);
    if (replay.state.phase !== "ended") throw new Error("This life has not ended yet.");
    const evidence = await buildEvidence({ life: current, save, state: replay.state, worldFingerprint: engine.fingerprint });
    const evidenceJson = canonicalJson(evidence);
    return { evidence, evidence_json: evidenceJson, evidence_hash: await sha256Hex(evidenceJson), signature: "0".repeat(128), verifier_kind: "server-signer" };
  };
}
