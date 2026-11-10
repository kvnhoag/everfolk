import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalJson } from "../src/random.ts";
import { createEngine } from "../src/index.ts";
import type { LifeState, SaveFile, WorldPack } from "../src/types.ts";
import type { Evidence, LifeView } from "../chain/types.ts";
import { commandsHash, sha256Hex } from "../chain/hash.ts";
import { rankedObligations } from "../chain/ranked-rules.ts";
import { createServerSignerVerifier, VerificationError } from "../server/ranked/verifier.ts";

const CONTRACT = "lives.testnet";
const SECRET = "07".repeat(32);
const world = JSON.parse(readFileSync(new URL("../worlds/sandbox.json", import.meta.url), "utf8")) as WorldPack;
const SEED = "ab".repeat(32);

function play(untilEnd: boolean): SaveFile {
  const engine = createEngine(world);
  let state = engine.start(SEED);
  for (let i = 0; i < 400 && state.phase !== "ended"; i++) {
    if (!untilEnd && state.age >= 3) break;
    state = state.phase === "choice" ? engine.choose(state, engine.getChoices(state)[0].id) : engine.advance(state);
  }
  return JSON.parse(engine.save(state)) as SaveFile;
}

/** The on-chain record an honest client leaves: every five-year checkpoint the rules require. */
async function lifeFor(save: SaveFile): Promise<LifeView> {
  const { required } = rankedObligations(createEngine(world), 0, save);
  const checkpoints = await Promise.all(required.filter(o => o.kind === "checkpoint").map(async o => ({ step: o.step, commands_hash: await commandsHash(save.commands, o.step) })));
  return {
    life_id: "5", account_id: "alice.testnet", seed: save.seed, world_version: `${world.id}-${world.version}`, status: "alive",
    figure_picks: [], draws: [], checkpoints, started_at_ms: 0,
  };
}

const stubEvidence = async (input: { life: LifeView; save: SaveFile; state: LifeState; worldFingerprint: string }): Promise<Evidence> => ({
  v: 1, seed: input.life.seed, life_id: input.life.life_id, account_id: input.life.account_id, world_version: input.life.world_version,
  world_fingerprint: input.worldFingerprint, save_hash: await sha256Hex(canonicalJson(input.save)), stats: input.state.stats, skills: {},
  origin_id: input.state.originId, peak_job_id: null, accomplishments: [], death_age: input.state.age, birth_year: -350,
  death_year: input.state.year, career_group: "performance", matched_figures: [], sources: [],
});

const verifier = () => createServerSignerVerifier({
  secretHex: SECRET, contractId: CONTRACT, buildEvidence: stubEvidence,
  loadWorld: version => (version === `${world.id}-${world.version}` ? world : null),
});

test("signs evidence for a finished life that verifies with the published key", async () => {
  const save = play(true);
  const v = await verifier();
  const signed = await v.verify(await lifeFor(save), save);
  assert.equal(signed.verifier_kind, "server-signer");
  assert.equal(signed.evidence_json, canonicalJson(signed.evidence));
  assert.equal(signed.evidence_hash, await sha256Hex(signed.evidence_json));
  assert.equal(signed.evidence.seed, save.seed);
  const key = await crypto.subtle.importKey("pkcs8", Buffer.from("302e020100300506032b657004220420" + SECRET, "hex"), { name: "Ed25519" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const pub = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: jwk.x }, { name: "Ed25519" }, false, ["verify"]);
  assert.ok(await crypto.subtle.verify({ name: "Ed25519" }, pub, Buffer.from(signed.signature, "hex"), new TextEncoder().encode(signed.evidence_json)));
  assert.match(v.publicKey, /^ed25519:/);
});

test("refuses an unfinished life", async () => {
  const save = play(false);
  await assert.rejects((await verifier()).verify(await lifeFor(save), save), new VerificationError("This life has not ended yet."));
});

test("refuses an invalid ranked save with the validation reason", async () => {
  const save = play(true);
  await assert.rejects((await verifier()).verify({ ...(await lifeFor(save)), seed: "cd".repeat(32) }, save), new VerificationError("This save does not belong to this ranked life."));
});

test("refuses a world version the verifier does not have", async () => {
  const save = play(true);
  await assert.rejects((await verifier()).verify({ ...(await lifeFor(save)), world_version: "other-1" }, { ...save, worldId: "other", worldVersion: "1" }),
    new VerificationError("This world version is not supported by the verifier."));
});

test("refuses a save whose world content differs", async () => {
  const save = play(true);
  await assert.rejects((await verifier()).verify(await lifeFor(save), { ...save, worldFingerprint: "fnv1a64-0000000000000000" }),
    new VerificationError("This save was played on different world content."));
});
