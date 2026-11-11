import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KEY_DECISIONS } from "../chain/catalog/key-decisions.ts";
import { commandsHash } from "../chain/hash.ts";
import { checkRankedObligations } from "../chain/ranked-rules.ts";
import { activationCommand, applyCommand } from "../chain/validate-ranked.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { startRankedSession } from "../client/chain/ranked-session.ts";
import { createEngine } from "../src/index.ts";
import type { Command, SaveFile, WorldPack } from "../src/types.ts";

const CONTRACT = "everfolk-lives.testnet";
const world = JSON.parse(readFileSync(new URL("../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8")) as WorldPack;
const engine = createEngine(world);
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

async function honestLife(untilAge = 200) {
  const contract = createMockContract({ nobodyWeightBps: 5000 });
  const session = await startRankedSession({ contract, contractId: CONTRACT, verifyUrl: "x", world, storage: memory() });
  for (let i = 0; i < 20_000 && session.state.phase !== "ended" && session.state.age < untilAge; i++) {
    const command: Command = session.state.phase === "choice" ? { type: "choose", choice: session.choices()[0].id } : { type: "advance" };
    await session.dispatch(command);
  }
  return { contract, session, life: (await contract.getLife(session.life.life_id))!, save: JSON.parse(session.save()) as SaveFile };
}

test("an honestly played ranked life meets every obligation", async () => {
  const { life, save } = await honestLife();
  const result = checkRankedObligations(engine, life, save);
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
  assert.ok(life.draws.length > 0 && life.checkpoints.length > 0);
});

test("rejects a life that skipped the draws at its key decisions", async () => {
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const life = await contract.startLife("alexandria-ranked-1");
  let state = engine.start(life.seed);
  for (const pick of life.figure_picks) state = engine.influence(state, activationCommand(pick, CONTRACT));
  let seen = 0;
  for (let i = 0; i < 20_000 && state.phase !== "ended"; i++) {
    if (state.phase === "choice" && Object.hasOwn(KEY_DECISIONS, state.pendingEventId ?? "")) seen++;
    state = state.phase === "choice" ? engine.choose(state, engine.getChoices(state)[0].id) : engine.advance(state);
  }
  assert.ok(seen > 0);
  const result = checkRankedObligations(engine, (await contract.getLife(life.life_id))!, JSON.parse(engine.save(state)) as SaveFile);
  assert.deepEqual(result, { ok: false, reason: "A key decision in this life was not drawn on chain." });
});

test("rejects a draw made where no key decision was pending", async () => {
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const life = await contract.startLife("alexandria-ranked-1");
  let state = engine.start(life.seed);
  for (const pick of life.figure_picks) state = engine.influence(state, activationCommand(pick, CONTRACT));
  state = engine.advance(state);
  if (state.phase === "choice") state = engine.choose(state, engine.getChoices(state)[0].id);
  const commands = (JSON.parse(engine.save(state)) as SaveFile).commands;
  const draw = await contract.drawNpc(life.life_id, commands.length, "education", await commandsHash(commands, commands.length));
  assert.ok(draw.token_id);
  state = engine.influence(state, applyCommand(draw, CONTRACT));
  const result = checkRankedObligations(engine, (await contract.getLife(life.life_id))!, JSON.parse(engine.save(state)) as SaveFile);
  assert.deepEqual(result, { ok: false, reason: "This life has a draw where no key decision was pending." });
});

test("rejects a draw whose category does not match the decision", async () => {
  const { life, save } = await honestLife(40);
  const draw = life.draws[0];
  const wrong = draw.category === "fate" ? "war" : "fate";
  const tampered = { ...life, draws: [{ ...draw, category: wrong as typeof draw.category }, ...life.draws.slice(1)] };
  assert.deepEqual(checkRankedObligations(engine, tampered, save), { ok: false, reason: "A key decision in this life was drawn in the wrong category." });
});

test("rejects a life missing a five-year checkpoint", async () => {
  const { life, save } = await honestLife(40);
  const missing = { ...life, checkpoints: life.checkpoints.slice(1) };
  assert.deepEqual(checkRankedObligations(engine, missing, save), { ok: false, reason: "This life is missing a five-year checkpoint." });
});

test("returns the replayed state for the verifier", async () => {
  const { life, save, session } = await honestLife(30);
  const result = checkRankedObligations(engine, life, save);
  assert.ok(result.ok);
  assert.equal(engine.save(result.state), session.save());
});
