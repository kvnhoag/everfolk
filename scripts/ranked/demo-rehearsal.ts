// Replays the spec §11 demo story on a DEMO contract (100% figure drop, no "nobody" draws, no abandon cooldown).
//   CONTRACT_ID=demo.genesis-1794297139-6.testnet ALICE=a.testnet BOB=b.testnet CAROL=c.testnet DAVE=d.testnet \
//     node scripts/ranked/demo-rehearsal.ts
// Accounts must already be in ~/.near-credentials/testnet; the contract owner key too. Never run against the main contract.
// VERIFY_URL=http://localhost:5173/api/ranked/verify verifies through a running server (and stores evidence there)
// instead of in-process; EVIDENCE_BASE_URL sets where minted tokens link their evidence.
import { readFileSync } from "node:fs";
import { buildEvidence } from "../../chain/evidence.ts";
import { matchFigures } from "../../chain/match.ts";
import { NPC_ACTIONS, RANKED_WORLD_VERSION, type CareerGroup } from "../../chain/ids.ts";
import type { LifeView } from "../../chain/types.ts";
import { startRankedSession, type RankedSession } from "../../client/chain/ranked-session.ts";
import { createServerSignerVerifier } from "../../server/ranked/verifier.ts";
import { createEngine } from "../../src/index.ts";
import type { SaveFile, WorldPack } from "../../src/types.ts";
import { callMethod, createCliContract, viewMethod } from "./cli-contract.ts";
import { nextState, type PathId } from "./path-policies.ts";

const ROOT = new URL("../../", import.meta.url);
const env = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Set ${name}.`); return value; };
const contractId = env("CONTRACT_ID");
if (contractId === "everfolk-lives-11101338.testnet") throw new Error("The rehearsal changes contract settings; use the demo contract.");
const [alice, bob, carol, dave] = ["ALICE", "BOB", "CAROL", "DAVE"].map(env);
const secret = /RANKED_VERIFIER_SECRET=([0-9a-f]{64})/.exec(readFileSync(new URL(".dev.vars", ROOT), "utf8"))?.[1];
if (!secret) throw new Error("RANKED_VERIFIER_SECRET is missing from .dev.vars.");
const world = JSON.parse(readFileSync(new URL("worlds/ranked/alexandria-ranked-1.json", ROOT), "utf8")) as WorldPack;
const engine = createEngine(world);
const verifyUrl = process.env.VERIFY_URL;
const verifier = await createServerSignerVerifier({ secretHex: secret, contractId, buildEvidence, loadWorld: v => (v === RANKED_WORLD_VERSION ? world : null) });
const near = (yocto: string) => (Number(BigInt(yocto) / 10n ** 18n) / 1e6).toFixed(4);
const say = (line: string) => console.log(`\n▶ ${line}`);
const explorer = `https://testnet.nearblocks.io/address/${contractId}`;

function memory() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), removeItem: (k: string) => void items.delete(k) };
}

async function clearActive(account: string): Promise<void> {
  const active = await viewMethod<LifeView | null>(contractId, "active_life_of", { account_id: account });
  if (active) await callMethod(account, contractId, "abandon_life", { life_id: active.life_id });
}

async function playPath(account: string, path: PathId, stop?: (s: RankedSession) => boolean): Promise<RankedSession> {
  await clearActive(account);
  const session = await startRankedSession({ contract: createCliContract(contractId, account), contractId, verifyUrl: verifyUrl ?? "in-process", world, storage: memory() });
  for (let i = 0; i < 5_000 && session.state.phase !== "ended" && !stop?.(session); i++) await session.sync(nextState(engine, session.state, path));
  return session;
}

async function mintLife(session: RankedSession, action?: string) {
  const signed = verifyUrl
    ? await session.finish()
    : await verifier.verify((await viewMethod<LifeView>(contractId, "get_life", { life_id: session.life.life_id })), JSON.parse(session.save()) as SaveFile);
  if (verifyUrl) console.log(`   verified by ${verifyUrl}; evidence ${(signed as { evidence_url?: string }).evidence_url ?? signed.evidence_hash}`);
  const group = signed.evidence.career_group as CareerGroup;
  const result = await session.mint(signed, action && NPC_ACTIONS[group].actions.includes(action as never) ? action : NPC_ACTIONS[group].actions[0]);
  return { signed, result };
}

say(`Demo contract ${contractId}: figure drop 100%, no empty draws, no abandon wait (demo settings, disclosed).`);
const params = await viewMethod<Record<string, unknown>>(contractId, "get_params", {});
const evidenceBase = process.env.EVIDENCE_BASE_URL ?? params.evidence_base_url;
await callMethod(contractId, contractId, "set_params", { params: { ...params, drop_rate_bps: 10_000, nobody_weight_bps: 0, abandon_cooldown_ms: 0, evidence_base_url: evidenceBase } });

say(`1. ${alice} lives as a copyist and mints the life.`);
const aliceLife = await playPath(alice, "letters");
const aliceMint = await mintLife(aliceLife, "letters.teach");
console.log(`   ${alice} → token ${aliceMint.result.token_id} (${aliceMint.result.kind}, ${aliceMint.signed.evidence.career_group}), action "Teach the young"`);
const aliceToken = aliceMint.result.token_id;

say(`2–3. ${bob} follows Euclid's path; at an education decision ${alice}'s life is drawn into his.`);
let bobMint: Awaited<ReturnType<typeof mintLife>> | null = null;
for (let attempt = 1; attempt <= 8 && !bobMint; attempt++) {
  const bobLife = await playPath(bob, "euclid");
  const touched = bobLife.life.draws.some(d => d.token_id === aliceToken);
  const matched = matchFigures(bobLife.state);
  console.log(`   attempt ${attempt}: died at ${bobLife.state.age}, matched [${matched.join(", ")}], drew ${alice}: ${touched}`);
  if (matched.includes("euclid") && touched) bobMint = await mintLife(bobLife);
  else await clearActive(bob);
}
if (!bobMint) throw new Error("Bob never qualified as Euclid with Alice's influence in 8 lives; rerun.");
console.log(`   ${bob} → token ${bobMint.result.token_id}: ${bobMint.result.kind} ${bobMint.result.figure_id ?? ""}, rarity ${bobMint.result.rarity}`);
console.log(`   sources: ${bobMint.signed.evidence.sources.map(s => `#${s.token_id} impact ${s.impact}`).join(", ")}`);
console.log(`   ${alice} claimable now: ${near(await viewMethod<string>(contractId, "balance_of", { account_id: alice }))} NEAR`);
const euclidToken = bobMint.result.token_id;

say(`4. ${bob}'s Euclid keeps "Open a school"; ${carol} is born into that world.`);
await callMethod(bob, contractId, "set_action", { token_id: euclidToken, action_id: "euclid.school" });
const carolLife = await playPath(carol, "letters", s => s.state.age >= 14);
// One copy per figure shapes each life, chosen by Affection; on a re-run an earlier Euclid may be the one picked.
const picked = carolLife.life.figure_picks.find(p => p.figure_id === "euclid");
const school = picked && carolLife.state.journal.find(entry => entry.type === "event" && (entry as { source?: { tokenId: string } }).source?.tokenId === picked.token_id);
console.log(`   born with Euclid (copy #${picked?.token_id ?? "none"}${picked?.token_id === euclidToken ? ", Bob's" : ""}): ${Boolean(picked)}; school reached her: ${school ? `age ${school.age} — ${school.text.slice(0, 90)}` : "not yet"}`);

say(`5. ${bob} lists Euclid; ${dave} buys it; ${alice} earns again as a source.`);
const before = BigInt(await viewMethod<string>(contractId, "balance_of", { account_id: alice }));
await callMethod(bob, contractId, "list", { token_id: euclidToken, price: "2000000000000000000000000" }, "1 yoctoNEAR");
await callMethod(dave, contractId, "buy", { token_id: euclidToken }, "2 NEAR", "100.0 Tgas");
const after = BigInt(await viewMethod<string>(contractId, "balance_of", { account_id: alice }));
const owner = (await viewMethod<{ owner_id: string }>(contractId, "nft_token", { token_id: euclidToken })).owner_id;
console.log(`   Euclid now owned by ${owner}; ${alice} earned ${near((after - before).toString())} NEAR from the resale`);
const stats = await viewMethod<{ lives_influenced: number; earned: string }>(contractId, "token_stats", { token_id: aliceToken });
console.log(`   ${alice}'s copyist: affected ${stats.lives_influenced} life, earned ${near(stats.earned)} NEAR in total`);
console.log(`\n✓ REHEARSAL OK — ${explorer}`);
