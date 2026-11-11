import assert from "node:assert/strict";
import test from "node:test";
import { commandsHash } from "../chain/hash.ts";
import type { LifeView } from "../chain/types.ts";
import { activationCommand, applyCommand, validateRankedSave } from "../chain/validate-ranked.ts";
import type { Command, SaveFile } from "../src/types.ts";

const CONTRACT = "everfolk-lives.testnet";
const SEED = "ab".repeat(32);

/** Euclid copy #4 active at birth; token #9 drawn at an education decision after three ordinary commands. */
async function fixture(): Promise<{ life: LifeView; save: SaveFile }> {
  const figure = { figure_id: "euclid" as const, token_id: "4", action_id: "euclid.school", rarity: 2 };
  const commands: Command[] = [activationCommand(figure, CONTRACT), { type: "avatar", variant: 1 }, { type: "advance" }, { type: "advance" }];
  const drawStep = commands.length;
  const draw = { step: drawStep, category: "education" as const, token_id: "9", action_id: "letters.teach", rarity: 1, commands_hash: await commandsHash(commands, drawStep) };
  commands.push(applyCommand(draw, CONTRACT), { type: "choose", choice: "study" }, { type: "advance" });
  const checkpoint = { step: commands.length, commands_hash: await commandsHash(commands, commands.length) };
  commands.push({ type: "advance" });
  const life: LifeView = {
    life_id: "7", account_id: "alice.testnet", seed: SEED, world_version: "alexandria-ranked-1", status: "alive",
    figure_picks: [figure], draws: [draw], checkpoints: [checkpoint], started_at_ms: 0,
  };
  const save: SaveFile = { schemaVersion: 1, worldId: "alexandria", worldVersion: "ranked-1", worldFingerprint: "x", seed: SEED, commands };
  return { life, save };
}

test("accepts a well-formed ranked save", async () => {
  const { life, save } = await fixture();
  assert.deepEqual(await validateRankedSave(life, save, CONTRACT), { ok: true });
});

test("figure activations carry rarity power and the token as source", () => {
  assert.deepEqual(activationCommand({ figure_id: "euclid", token_id: "4", action_id: "euclid.school", rarity: 2 }, CONTRACT), {
    type: "influence", mode: "activate", entry: "euclid.school", power: 1.5, source: { contractId: CONTRACT, tokenId: "4" },
  });
});

test("rejects a save rewound past a checkpoint", async () => {
  const { life, save } = await fixture();
  const rewound = { ...save, commands: save.commands.map((c, i) => (i === 5 ? { type: "choose", choice: "trade" } : c)) as Command[] };
  assert.deepEqual(await validateRankedSave(life, rewound, CONTRACT), { ok: false, reason: "This life was changed after a recorded checkpoint." });
});

test("rejects an injected influence not drawn on chain", async () => {
  const { life, save } = await fixture();
  const extra = applyCommand({ step: 0, category: "education", token_id: "11", action_id: "letters.teach", rarity: 4, commands_hash: "" }, CONTRACT);
  const injected = { ...save, commands: [...save.commands, extra] };
  assert.deepEqual(await validateRankedSave(life, injected, CONTRACT), { ok: false, reason: "This life contains an influence that was not drawn on chain." });
});

test("rejects a drawn influence that is missing from the save", async () => {
  const { life, save } = await fixture();
  const step = life.draws[0].step;
  const missing = { ...save, commands: save.commands.map((c, i) => (i === step ? { type: "advance" } : c)) as Command[] };
  assert.deepEqual(await validateRankedSave(life, missing, CONTRACT), { ok: false, reason: "A recorded influence is missing from this life." });
});

test("rejects missing figure activation", async () => {
  const { life, save } = await fixture();
  const skipped = { ...save, commands: save.commands.slice(1) };
  assert.deepEqual(await validateRankedSave(life, skipped, CONTRACT), { ok: false, reason: "The famous figures of this life were not applied at birth." });
});

test("rejects a different seed", async () => {
  const { life, save } = await fixture();
  assert.deepEqual(await validateRankedSave(life, { ...save, seed: "cd".repeat(32) }, CONTRACT), { ok: false, reason: "This save does not belong to this ranked life." });
});

test("rejects a different world version", async () => {
  const { life, save } = await fixture();
  assert.deepEqual(await validateRankedSave(life, { ...save, worldVersion: "0.33.0" }, CONTRACT), { ok: false, reason: "This save was played in a different world version." });
});

test("rejects a non-alive life", async () => {
  const { life, save } = await fixture();
  assert.deepEqual(await validateRankedSave({ ...life, status: "minted" }, save, CONTRACT), { ok: false, reason: "This life has already been minted or abandoned." });
});

test("rejects a checkpoint beyond the end of the save", async () => {
  const { life, save } = await fixture();
  const short = { ...save, commands: save.commands.slice(0, 6) };
  assert.deepEqual(await validateRankedSave(life, short, CONTRACT), { ok: false, reason: "This life was changed after a recorded checkpoint." });
});

test("rejects two draws recorded at the same step", async () => {
  const { life, save } = await fixture();
  const twice = { ...life, draws: [life.draws[0], { ...life.draws[0] }] };
  assert.deepEqual(await validateRankedSave(twice, save, CONTRACT), { ok: false, reason: "Two draws were recorded at the same moment." });
});

test("rejects an empty draw that carries a token", async () => {
  const { life, save } = await fixture();
  const odd = { ...life, draws: [...life.draws, { step: 5, category: "war" as const, token_id: null, action_id: "military.mentor", rarity: 1, commands_hash: life.draws[0].commands_hash }] };
  assert.deepEqual(await validateRankedSave(odd, save, CONTRACT), { ok: false, reason: "A recorded influence is missing from this life." });
});

test("rejects a negative or fractional step", async () => {
  const { life, save } = await fixture();
  for (const step of [-1, 1.5]) {
    const bad = { ...life, checkpoints: [{ step, commands_hash: life.checkpoints[0].commands_hash }] };
    assert.deepEqual(await validateRankedSave(bad, save, CONTRACT), { ok: false, reason: "This life was changed after a recorded checkpoint." });
  }
});
