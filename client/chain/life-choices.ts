import { sha256Hex } from "../../chain/hash.ts";
import { canonicalJson } from "../../src/random.ts";
import { createEngine } from "../../src/index.ts";
import type { Evidence } from "../../chain/types.ts";
import type { JournalEntry, SaveFile, WorldPack } from "../../src/types.ts";

/** Both the attested evidence and its saved decisions must match their content hashes before displaying a history. */
export async function verifiedLifeChoices(hash: string, fetcher: typeof fetch = fetch, world?: WorldPack): Promise<JournalEntry[]> {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("This life has no valid evidence reference.");
  const response = await fetcher(`/api/ranked/evidence/${hash}`);
  if (!response.ok) throw new Error("This life's verified choices are unavailable on this server.");
  const data = await response.json() as { evidence: Evidence; save: SaveFile };
  if (await sha256Hex(canonicalJson(data.evidence)) !== hash || await sha256Hex(canonicalJson(data.save)) !== data.evidence.save_hash) throw new Error("The life record does not match its on-chain evidence hash.");
  const pack = world ?? (await import("../../worlds/ranked/alexandria-ranked-1.json")).default as unknown as WorldPack;
  const state = createEngine(pack).load(JSON.stringify(data.save));
  return state.journal.filter(entry => entry.type === "choice" || entry.type === "outcome" || entry.type === "ending");
}
