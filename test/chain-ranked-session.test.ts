import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KEY_DECISIONS } from "../chain/catalog/key-decisions.ts";
import { activationCommand, applyCommand, validateRankedSave } from "../chain/validate-ranked.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { startRankedSession, resumeRankedSession, type RankedSession, type SessionStorage } from "../client/chain/ranked-session.ts";
import type { Command, SaveFile, WorldPack } from "../src/types.ts";

const CONTRACT = "everfolk-lives.testnet";
const world = JSON.parse(readFileSync(new URL("../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8")) as WorldPack;

function memoryStorage(): SessionStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return { items, getItem: key => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value), removeItem: key => void items.delete(key) };
}

const commandsOf = (session: RankedSession): Command[] => (JSON.parse(session.save()) as SaveFile).commands;

/** Plays with the first offered choice until `stop` holds or the life ends. */
async function playUntil(session: RankedSession, stop: (s: RankedSession) => boolean, limit = 2_000): Promise<void> {
  for (let i = 0; i < limit && session.state.phase !== "ended" && !stop(session); i++) {
    const command: Command = session.state.phase === "choice" ? { type: "choose", choice: session.choices()[0].id } : { type: "advance" };
    await session.dispatch(command);
  }
}

async function start(options: { nobodyWeightBps?: number } = {}) {
  const contract = createMockContract({ nobodyWeightBps: options.nobodyWeightBps ?? 0 });
  const storage = memoryStorage();
  const session = await startRankedSession({ contract, contractId: CONTRACT, verifyUrl: "https://everfolk.test/api/ranked/verify", world, storage });
  return { contract, storage, session };
}

test("figure activations are the first commands", async () => {
  const { session } = await start();
  assert.ok(session.life.figure_picks.length > 0, "the mock seeds one copy of each figure");
  const commands = commandsOf(session);
  session.life.figure_picks.forEach((pick, index) => assert.deepEqual(commands[index], activationCommand(pick, CONTRACT)));
});

test("key decision triggers exactly one draw", async () => {
  const { contract, session } = await start();
  await playUntil(session, s => s.lastDraw !== null);
  assert.ok(session.lastDraw, "a key decision came up and was drawn");
  const before = (await contract.getLife(session.life.life_id))!.draws.length;
  assert.equal(before, 1);
  assert.ok(Object.hasOwn(KEY_DECISIONS, session.state.pendingEventId ?? ""), "the drawn decision is still pending");
  const life = await contract.getLife(session.life.life_id);
  assert.equal(life!.draws[0].category, KEY_DECISIONS[session.state.pendingEventId!]);
});

test("non-null draw inserts apply influence at draw.step", async () => {
  const { session } = await start({ nobodyWeightBps: 0 });
  await playUntil(session, s => s.lastDraw?.token_id != null);
  const draw = session.lastDraw!;
  assert.ok(draw.token_id, "with no nobody weight the pool always answers");
  assert.deepEqual(commandsOf(session)[draw.step], applyCommand(draw, CONTRACT));
});

test("influence commands cannot be dispatched by the player", async () => {
  const { session } = await start();
  await assert.rejects(
    session.dispatch({ type: "influence", mode: "apply", entry: "letters.teach", power: 3, source: { contractId: CONTRACT, tokenId: "1" } }),
    /only come from the chain/,
  );
});

test("checkpoint every 5 years", async () => {
  const { contract, session } = await start();
  await playUntil(session, s => s.state.age >= 11);
  const checkpoints = (await contract.getLife(session.life.life_id))!.checkpoints;
  assert.ok(checkpoints.length >= 2, `expected checkpoints at ages 5 and 10, got ${checkpoints.length}`);
});

test("session save passes validateRankedSave", async () => {
  const { contract, session } = await start({ nobodyWeightBps: 5000 });
  await playUntil(session, s => s.state.age >= 25);
  const life = (await contract.getLife(session.life.life_id))!;
  assert.deepEqual(await validateRankedSave(life, JSON.parse(session.save()) as SaveFile, CONTRACT), { ok: true });
});

test("the save is persisted and resumes without rewinding", async () => {
  const { contract, storage, session } = await start();
  await playUntil(session, s => s.state.age >= 6);
  const key = `everfolk.ranked.${session.life.life_id}`;
  assert.equal(storage.getItem(key), session.save());
  const resumed = await resumeRankedSession({ contract, contractId: CONTRACT, verifyUrl: "x", world, storage }, session.life.life_id);
  assert.equal(resumed.save(), session.save());
  assert.equal(resumed.state.age, session.state.age);
});

test("finish sends the save to the verifier and returns signed evidence", async () => {
  const { session } = await start({ nobodyWeightBps: 5000 });
  await playUntil(session, () => false, 20_000);
  assert.equal(session.state.phase, "ended");
  const calls: { url: string; body: unknown }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ evidence_hash: "e".repeat(64), signature: "a".repeat(128) }));
  }) as unknown as typeof fetch;
  const signed = await session.finish(fakeFetch);
  assert.equal(signed.signature, "a".repeat(128));
  assert.deepEqual(calls[0].body, { life_id: session.life.life_id, save: session.save() });
});

test("finish reports the verifier's reason when it refuses", async () => {
  const { session } = await start();
  await playUntil(session, () => false, 20_000);
  const refuse = (async () => new Response(JSON.stringify({ error: "This life has not ended yet." }), { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(session.finish(refuse), /This life has not ended yet\./);
});

test("resuming while a drawn decision is still pending does not draw again", async () => {
  const { contract, storage, session } = await start({ nobodyWeightBps: 0 });
  await playUntil(session, s => s.lastDraw?.token_id != null);
  const drawsBefore = (await contract.getLife(session.life.life_id))!.draws.length;
  const resumed = await resumeRankedSession({ contract, contractId: CONTRACT, verifyUrl: "x", world, storage }, session.life.life_id);
  await resumed.dispatch({ type: "choose", choice: resumed.choices()[0].id });
  const after = (await contract.getLife(session.life.life_id))!;
  const extra = after.draws.slice(drawsBefore).filter(d => d.step <= after.draws[drawsBefore - 1].step + 1);
  assert.deepEqual(extra, []);
});

test("sync replays commands made by the free engine and draws at key decisions", async () => {
  const { contract, session } = await start({ nobodyWeightBps: 0 });
  const { createEngine } = await import("../src/index.ts");
  const free = createEngine(world);
  let next = session.state;
  let keyDecisionsPassed = 0;
  for (let i = 0; i < 5_000 && next.phase !== "ended" && (keyDecisionsPassed < 2 || next.age < 30); i++) {
    if (next.phase === "choice" && Object.hasOwn(KEY_DECISIONS, next.pendingEventId ?? "")) keyDecisionsPassed++;
    next = next.phase === "choice" ? free.choose(next, free.getChoices(next)[0].id) : free.advance(next);
  }
  assert.ok(keyDecisionsPassed >= 2, "the free engine passed key decisions inside the batch");
  const synced = await session.sync(next);
  assert.equal(synced, session.state);
  const life = (await contract.getLife(session.life.life_id))!;
  assert.ok(life.draws.length > 0, "key decisions inside the batch were drawn on chain");
  assert.ok(life.checkpoints.length >= 1, "checkpoints were recorded while replaying");
  assert.deepEqual(await validateRankedSave(life, JSON.parse(session.save()) as SaveFile, CONTRACT), { ok: true });
});

test("sync rejects a state that does not continue this ranked life", async () => {
  const { session } = await start();
  const { createEngine } = await import("../src/index.ts");
  const other = createEngine(world).start("cd".repeat(32));
  await assert.rejects(session.sync(other), /does not continue this ranked life/);
});

test("beginRankedSession starts a life the entry screen already opened, and resumes it later", async () => {
  const { beginRankedSession } = await import("../client/chain/ranked-session.ts");
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const storage = memoryStorage();
  const options = { contract, contractId: CONTRACT, verifyUrl: "x", world, storage };
  const life = await contract.startLife("alexandria-ranked-1");
  const first = await beginRankedSession(options, life);
  assert.deepEqual(commandsOf(first)[0], activationCommand(life.figure_picks[0], CONTRACT));
  await playUntil(first, s => s.state.age >= 6);
  const again = await beginRankedSession(options, (await contract.getLife(life.life_id))!);
  assert.equal(again.save(), first.save());
});

test("beginRankedSession refuses a recorded life with no progress on this device", async () => {
  const { beginRankedSession } = await import("../client/chain/ranked-session.ts");
  const { contract, session } = await start();
  await playUntil(session, s => s.state.age >= 6);
  const life = (await contract.getLife(session.life.life_id))!;
  await assert.rejects(beginRankedSession({ contract, contractId: CONTRACT, verifyUrl: "x", world, storage: memoryStorage() }, life), /no saved progress/);
});

/** Wraps a contract so the next `drawNpc` / `checkpoint` call fails, optionally after it already landed on chain. */
function flaky(contract: ReturnType<typeof createMockContract>) {
  const failures = { drawAfterLanding: 0, checkpointBeforeLanding: 0, getLife: 0 };
  const wrapped = Object.create(contract) as typeof contract;
  wrapped.getLife = async (...args) => {
    if (failures.getLife > 0) { failures.getLife--; throw new Error("RPC timeout"); }
    return contract.getLife(...args);
  };
  wrapped.drawNpc = async (...args) => {
    const draw = await contract.drawNpc(...args);
    if (failures.drawAfterLanding > 0) { failures.drawAfterLanding--; throw new Error("draw_npc failed: Transaction has not finished yet"); }
    return draw;
  };
  wrapped.checkpoint = async (...args) => {
    if (failures.checkpointBeforeLanding > 0) { failures.checkpointBeforeLanding--; throw new Error("checkpoint failed: 429 Too Many Requests"); }
    return contract.checkpoint(...args);
  };
  return { wrapped, failures };
}

async function playThrough(session: RankedSession, untilAge: number, onError: (error: unknown) => void) {
  for (let i = 0; i < 20_000 && session.state.phase !== "ended" && session.state.age < untilAge; i++) {
    const command: Command = session.state.phase === "choice" ? { type: "choose", choice: session.choices()[0].id } : { type: "advance" };
    try { await session.dispatch(command); } catch (error) { onError(error); }
  }
}

test("a draw that landed on chain but failed on the client is recovered", async () => {
  const { checkRankedObligations } = await import("../chain/ranked-rules.ts");
  const { createEngine } = await import("../src/index.ts");
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const { wrapped, failures } = flaky(contract);
  const session = await startRankedSession({ contract: wrapped, contractId: CONTRACT, verifyUrl: "x", world, storage: memoryStorage() });
  failures.drawAfterLanding = 3;
  const errors: unknown[] = [];
  await playThrough(session, 40, error => errors.push(error));
  const life = (await contract.getLife(session.life.life_id))!;
  assert.ok(life.draws.length >= 1);
  const result = checkRankedObligations(createEngine(world), life, JSON.parse(session.save()) as SaveFile);
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
  assert.deepEqual(await validateRankedSave(life, JSON.parse(session.save()) as SaveFile, CONTRACT), { ok: true });
});

test("a failed checkpoint is retried before the life moves on, and the draw is not skipped", async () => {
  const { checkRankedObligations } = await import("../chain/ranked-rules.ts");
  const { createEngine } = await import("../src/index.ts");
  const { ChainActionError } = await import("../client/chain/ranked-session.ts");
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const { wrapped, failures } = flaky(contract);
  const session = await startRankedSession({ contract: wrapped, contractId: CONTRACT, verifyUrl: "x", world, storage: memoryStorage() });
  failures.checkpointBeforeLanding = 2;
  const errors: unknown[] = [];
  await playThrough(session, 40, error => errors.push(error));
  assert.equal(errors.length, 2);
  assert.ok(errors.every(error => error instanceof ChainActionError));
  const life = (await contract.getLife(session.life.life_id))!;
  const result = checkRankedObligations(createEngine(world), life, JSON.parse(session.save()) as SaveFile);
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
});

test("sync surfaces chain failures instead of swallowing them", async () => {
  const { ChainActionError } = await import("../client/chain/ranked-session.ts");
  const { createEngine } = await import("../src/index.ts");
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const { wrapped, failures } = flaky(contract);
  const session = await startRankedSession({ contract: wrapped, contractId: CONTRACT, verifyUrl: "x", world, storage: memoryStorage() });
  failures.checkpointBeforeLanding = 1;
  const free = createEngine(world);
  let next = session.state;
  for (let i = 0; i < 400 && next.age < 6 && next.phase !== "ended"; i++) next = next.phase === "choice" ? free.choose(next, free.getChoices(next)[0].id) : free.advance(next);
  await assert.rejects(session.sync(next), ChainActionError);
});

test("resume applies a draw that landed on chain but was never saved on this device", async () => {
  const { checkRankedObligations } = await import("../chain/ranked-rules.ts");
  const { createEngine } = await import("../src/index.ts");
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const { wrapped, failures } = flaky(contract);
  const storage = memoryStorage();
  const session = await startRankedSession({ contract: wrapped, contractId: CONTRACT, verifyUrl: "x", world, storage });
  failures.drawAfterLanding = 1;
  failures.getLife = 1; // the re-read fails too, as if the tab closed before anything was saved
  let failed = false;
  for (let i = 0; i < 20_000 && !failed && session.state.phase !== "ended"; i++) {
    const command: Command = session.state.phase === "choice" ? { type: "choose", choice: session.choices()[0].id } : { type: "advance" };
    try { await session.dispatch(command); } catch { failed = true; }
  }
  assert.ok(failed, "a draw failed after landing");
  // The tab closes here: a new session resumes from what this device saved.
  const resumed = await resumeRankedSession({ contract, contractId: CONTRACT, verifyUrl: "x", world, storage }, session.life.life_id);
  await playThrough(resumed, 30, () => {});
  const life = (await contract.getLife(session.life.life_id))!;
  const result = checkRankedObligations(createEngine(world), life, JSON.parse(resumed.save()) as SaveFile);
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
});

test("a mint that landed on chain but failed on the client still returns the minted token", async () => {
  const contract = createMockContract({ nobodyWeightBps: 5000 });
  const storage = memoryStorage();
  const session = await startRankedSession({ contract, contractId: CONTRACT, verifyUrl: "x", world, storage });
  await playUntil(session, () => false, 20_000);
  const { createServerSignerVerifier } = await import("../server/ranked/verifier.ts");
  const { buildEvidence } = await import("../chain/evidence.ts");
  const verifier = await createServerSignerVerifier({ secretHex: "07".repeat(32), contractId: CONTRACT, buildEvidence, loadWorld: () => world });
  const signed = await verifier.verify((await contract.getLife(session.life.life_id))!, JSON.parse(session.save()) as SaveFile);
  const flakyMint = Object.create(contract) as typeof contract;
  flakyMint.mintLife = async (...args) => { await contract.mintLife(...args); throw new Error("Transaction has not finished yet"); };
  (session as unknown as { options: { contract: typeof contract } }).options.contract = flakyMint;
  const action = { letters: "letters.teach", military: "military.mentor", commerce: "commerce.credit", craft: "craft.apprentice", sky: "sky.omen", performance: "performance.lift" }[signed.evidence.career_group];
  const result = await session.mint(signed, action);
  assert.ok(result.token_id);
  const token = await contract.token(result.token_id);
  assert.equal(token?.extra.life_id, session.life.life_id);
  assert.equal(storage.getItem(`everfolk.ranked.${session.life.life_id}`), null, "the local save is cleared once minted");
});

test("practice mode checks and signs a finished life in the browser, without the server", async () => {
  const { practiceVerifier } = await import("../client/chain/practice-verifier.ts");
  const contract = createMockContract({ nobodyWeightBps: 5000 });
  const session = await startRankedSession({ contract, contractId: CONTRACT, verifyUrl: "unused", world, storage: memoryStorage(), verifyLocally: practiceVerifier(world, contract, CONTRACT) });
  await playUntil(session, () => false, 20_000);
  const signed = await session.finish((async () => { throw new Error("no server in practice mode"); }) as unknown as typeof fetch);
  assert.equal(signed.evidence.seed, session.life.seed);
  assert.equal(signed.signature, "0".repeat(128));
  const group = signed.evidence.career_group;
  const action = { letters: "letters.teach", military: "military.mentor", commerce: "commerce.credit", craft: "craft.apprentice", sky: "sky.omen", performance: "performance.lift" }[group];
  assert.ok((await session.mint(signed, action)).token_id);
});

test("practice mode refuses a life that broke the ranked rules", async () => {
  const { practiceVerifier } = await import("../client/chain/practice-verifier.ts");
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const life = await contract.startLife("alexandria-ranked-1");
  const { createEngine } = await import("../src/index.ts");
  const engine = createEngine(world);
  let state = engine.start(life.seed);
  for (const pick of life.figure_picks) state = engine.influence(state, activationCommand(pick, CONTRACT));
  for (let i = 0; i < 20_000 && state.phase !== "ended"; i++) state = state.phase === "choice" ? engine.choose(state, engine.getChoices(state)[0].id) : engine.advance(state);
  await assert.rejects(practiceVerifier(world, contract, CONTRACT)(life, JSON.parse(engine.save(state))), /not drawn on chain/);
});
