// Plays and mints "genesis" ranked lives on testnet so the NPC draw pools are not empty for the demo.
//   CONTRACT_ID=everfolk-lives-11101338.testnet COUNT=6 node scripts/ranked/seed-genesis.ts
//   ACCOUNTS=a.testnet,b.testnet … reuses existing keychain accounts instead of the (rate-limited) faucet.
//   PATHS=military,sky … plays account i along career path i (scripts/ranked/path-policies.ts) instead of a yearly focus.
// Needs RANKED_VERIFIER_SECRET in .dev.vars (the key registered on the contract). Accounts come from the testnet faucet.
import { readFileSync } from "node:fs";
import { buildEvidence } from "../../chain/evidence.ts";
import { NPC_ACTIONS, RANKED_WORLD_VERSION, type CareerGroup } from "../../chain/ids.ts";
import { startRankedSession } from "../../client/chain/ranked-session.ts";
import { createServerSignerVerifier } from "../../server/ranked/verifier.ts";
import { createEngine } from "../../src/index.ts";
import type { WorldPack } from "../../src/types.ts";
import { advanceYearWithFocus, selectAutomaticChoice, type YearlyFocusId } from "../../client/yearly-focus.ts";
import { createCliContract, createFaucetAccount } from "./cli-contract.ts";
import { nextState, PATH_IDS, type PathId } from "./path-policies.ts";

const ROOT = new URL("../../", import.meta.url);
const contractId = process.env.CONTRACT_ID ?? "";
const count = Number(process.env.COUNT ?? 6);
if (!contractId) throw new Error("Set CONTRACT_ID.");
const secret = /RANKED_VERIFIER_SECRET=([0-9a-f]{64})/.exec(readFileSync(new URL(".dev.vars", ROOT), "utf8"))?.[1];
if (!secret) throw new Error("RANKED_VERIFIER_SECRET is missing from .dev.vars.");
const world = JSON.parse(readFileSync(new URL("worlds/ranked/alexandria-ranked-1.json", ROOT), "utf8")) as WorldPack;

const FOCUSES: readonly YearlyFocusId[] = ["study", "craft", "pottery", "study", "carving", "friends", "sculpture", "health", "study"];

/** Small deterministic PRNG so each genesis life explores different choices. */
function chooser(seed: number): (n: number) => number {
  let x = seed || 1;
  return n => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return Math.abs(x) % n; };
}

const reuse = (process.env.ACCOUNTS ?? "").split(",").map(a => a.trim()).filter(Boolean);
const paths = (process.env.PATHS ?? "").split(",").map(p => p.trim()).filter(Boolean) as PathId[];
for (const path of paths) if (!PATH_IDS.includes(path)) throw new Error(`Unknown path ${path}; use one of ${PATH_IDS.join(", ")}.`);

async function genesisLife(index: number, stamp: number): Promise<string> {
  const account = reuse[index - 1] ?? `genesis-${stamp}-${index}.testnet`;
  if (!reuse[index - 1]) await createFaucetAccount(account);
  const contract = createCliContract(contractId, account);
  const items = new Map<string, string>();
  const session = await startRankedSession({
    contract, contractId, verifyUrl: "in-process", world,
    storage: { getItem: k => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v), removeItem: k => void items.delete(k) },
  });
  // Play like a player: a yearly focus builds skills and work; decisions use Auto mode's safe pick, with some variety.
  const pick = chooser(stamp + index * 7919);
  const focus = FOCUSES[(index - 1) % FOCUSES.length];
  const engine = createEngine(world);
  const path = paths[index - 1];
  for (let i = 0; i < 5_000 && session.state.phase !== "ended"; i++) {
    const state = session.state;
    if (path) { await session.sync(nextState(engine, state, path)); continue; }
    if (state.phase === "choice") {
      const choices = engine.getChoices(state);
      const safe = selectAutomaticChoice(choices, world, state);
      await session.sync(engine.choose(state, (pick(10) < 7 && safe ? safe : choices[pick(choices.length)]).id));
    } else {
      await session.sync(advanceYearWithFocus(engine, state, focus));
    }
  }
  const verifier = await createServerSignerVerifier({ secretHex: secret!, contractId, buildEvidence, loadWorld: v => (v === RANKED_WORLD_VERSION ? world : null) });
  const life = await contract.getLife(session.life.life_id);
  const signed = await verifier.verify(life!, JSON.parse(session.save()));
  const group = signed.evidence.career_group as CareerGroup;
  const action = NPC_ACTIONS[group].actions[index % 2];
  const minted = await session.mint(signed, action);
  return `${account}: life ${session.life.life_id} → token ${minted.token_id} (${minted.kind}${minted.figure_id ? ` ${minted.figure_id}` : ""}, ${group}/${action}, rarity ${minted.rarity}, affection ${minted.affection}, age ${signed.evidence.death_age}, ${signed.evidence.sources.length} sources)`;
}

const stamp = Math.floor(Date.now() / 1000);
// One life at a time: the public testnet RPC rate-limits parallel signers.
for (let i = 1; i <= (reuse.length || count); i++) {
  try {
    console.log(`✓ ${await genesisLife(i, stamp)}`);
  } catch (error) {
    console.log(`✗ life ${i}: ${(error as Error).message.slice(0, 300)}`);
    process.exitCode = 1;
  }
}
