import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KEY_DECISIONS } from "../chain/catalog/key-decisions.ts";
import { NPC_ACTIONS } from "../chain/ids.ts";
import { activationCommand, applyCommand, validateRankedSave } from "../chain/validate-ranked.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { beginRankedSession, ChainActionError, startRankedSession, resumeRankedSession, type RankedSession, type SessionStorage } from "../client/chain/ranked-session.ts";
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
  const failures = { drawAfterLanding: 0, checkpointBeforeLanding: 0, checkpointAfterLanding: 0, getLife: 0 };
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
    await contract.checkpoint(...args);
    if (failures.checkpointAfterLanding > 0) { failures.checkpointAfterLanding--; throw new Error("checkpoint reply lost"); }
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

test("a matching checkpoint is recovered after its reply is lost", async () => {
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const { wrapped, failures } = flaky(contract);
  const session = await startRankedSession({ contract: wrapped, contractId: CONTRACT, verifyUrl: "x", world, storage: memoryStorage() });
  failures.checkpointAfterLanding = 1;
  await playUntil(session, s => s.state.age >= 6);
  assert.equal(failures.checkpointAfterLanding, 0, "the lost reply was recovered");
  const life = (await contract.getLife(session.life.life_id))!;
  assert.ok(life.checkpoints.length > 0);
  assert.deepEqual(await validateRankedSave(life, JSON.parse(session.save()) as SaveFile, CONTRACT), { ok: true });
});

function smallRankedWorld(): WorldPack {
  const fixture = JSON.parse(readFileSync(new URL("../worlds/sandbox.json", import.meta.url), "utf8")) as WorldPack;
  fixture.id = "alexandria";
  fixture.version = "ranked-1";
  return fixture;
}

test("a second session stops when another history already owns the checkpoint step", async () => {
  const fixture = smallRankedWorld();
  fixture.events[0].choices.push({ id: "other-observation", text: "Observe another thing.", outcomes: [
    { id: "other-notes", text: "A different notebook.", weight: 1, effects: [] },
  ] });
  const contract = createMockContract({ genesis: false });
  const life = await contract.startLife("alexandria-ranked-1");
  const options = { contract, contractId: CONTRACT, verifyUrl: "x", world: fixture };
  const first = await beginRankedSession({ ...options, storage: memoryStorage() }, life);
  const second = await beginRankedSession({ ...options, storage: memoryStorage() }, life);
  await first.dispatch({ type: "choose", choice: "observe" });
  await second.dispatch({ type: "choose", choice: "other-observation" });
  await playUntil(first, s => s.state.age >= 6);
  await assert.rejects(playUntil(second, s => s.state.age >= 6), {
    name: "ChainActionError", message: /different progress recorded on NEAR/,
  });
  assert.equal(second.state.age, 5, "the conflicting checkpoint must stop further play");
  const stoppedSave = second.save();
  const next: Command = second.state.phase === "choice" ? { type: "choose", choice: second.choices()[0].id } : { type: "advance" };
  await assert.rejects(second.dispatch(next), ChainActionError);
  assert.equal(second.save(), stoppedSave, "retry must not advance the conflicting history");
});

for (const conflict of ["hash", "category"] as const) test(`recovery refuses a draw with a conflicting ${conflict}`, async () => {
  const fixture = smallRankedWorld();
  fixture.events[0].id = "the-first-letters";
  fixture.events[0].trigger = { type: "age", at: 1 };
  const contract = createMockContract({ genesis: false });
  const wrapped = Object.create(contract) as typeof contract;
  wrapped.drawNpc = async (lifeId, step, category, hash) => {
    await contract.drawNpc(lifeId, step, conflict === "category" ? "war" : category, conflict === "hash" ? "f".repeat(64) : hash);
    throw new Error("draw reply lost");
  };
  const session = await startRankedSession({ contract: wrapped, contractId: CONTRACT, verifyUrl: "x", world: fixture, storage: memoryStorage() });
  await assert.rejects(session.dispatch({ type: "advance" }), {
    name: "ChainActionError", message: /different progress recorded on NEAR/,
  });
  assert.equal(session.lastDraw, null, "a conflicting draw must never be adopted");
  assert.equal(session.life.draws.length, 0);
  assert.equal(commandsOf(session).length, 1, "no conflicting influence was inserted");
});

test("recovering a non-empty draw after a storage failure applies its influence only once", async () => {
  const contract = createMockContract({ nobodyWeightBps: 0 });
  const storage = memoryStorage();
  const persist = storage.setItem;
  let failures = 1;
  storage.setItem = (key, value) => {
    const last = (JSON.parse(value) as SaveFile).commands.at(-1);
    if (failures && last?.type === "influence" && last.mode === "apply") {
      failures--;
      throw new Error("Storage temporarily unavailable");
    }
    persist(key, value);
  };
  const session = await startRankedSession({ contract, contractId: CONTRACT, verifyUrl: "x", world, storage });
  await playUntil(session, s => s.lastDraw?.token_id != null);
  assert.equal(failures, 0, "the influence's first persistence attempt failed");
  const draw = session.lastDraw!;
  const commands = commandsOf(session);
  assert.deepEqual(commands[draw.step], applyCommand(draw, CONTRACT));
  assert.equal(commands.length, draw.step + 1, "recovery did not insert a second influence command");
  assert.deepEqual(await validateRankedSave((await contract.getLife(session.life.life_id))!, JSON.parse(session.save()) as SaveFile, CONTRACT), { ok: true });
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

test("a mint with a lost response is recovered directly even after its token changes owner", async () => {
  const contract = createMockContract({ nobodyWeightBps: 5000 });
  const storage = memoryStorage();
  const session = await startRankedSession({ contract, contractId: CONTRACT, verifyUrl: "x", world, storage });
  await playUntil(session, () => false, 20_000);
  const { createServerSignerVerifier } = await import("../server/ranked/verifier.ts");
  const { buildEvidence } = await import("../chain/evidence.ts");
  const verifier = await createServerSignerVerifier({ secretHex: "07".repeat(32), contractId: CONTRACT, buildEvidence, loadWorld: () => world });
  const signed = await verifier.verify((await contract.getLife(session.life.life_id))!, JSON.parse(session.save()) as SaveFile);
  const flakyMint = Object.create(contract) as typeof contract;
  flakyMint.mintLife = async (...args) => {
    const result = await contract.mintLife(...args);
    await contract.list(result.token_id, "100");
    await contract.as("buyer.testnet").buy(result.token_id, "100");
    throw new Error("Transaction has not finished yet");
  };
  flakyMint.tokensOf = async () => { throw new Error("Mint recovery must not depend on the owner's current collection"); };
  (session as unknown as { options: { contract: typeof contract } }).options.contract = flakyMint;
  const action = { letters: "letters.teach", military: "military.mentor", commerce: "commerce.credit", craft: "craft.apprentice", sky: "sky.omen", performance: "performance.lift" }[signed.evidence.career_group];
  const result = await session.mint(signed, action);
  assert.ok(result.token_id);
  const token = await contract.token(result.token_id);
  assert.equal(token?.extra.life_id, session.life.life_id);
  assert.equal(token?.owner_id, "buyer.testnet");
  assert.equal(storage.getItem(`everfolk.ranked.${session.life.life_id}`), null, "the local save is cleared once minted");
});

async function finishedSmallLife() {
  const fixture = smallRankedWorld();
  const contract = createMockContract({ genesis: false });
  const storage = memoryStorage();
  const options = { contract, contractId: CONTRACT, verifyUrl: "unused", world: fixture, storage };
  const session = await startRankedSession(options);
  await playUntil(session, () => false);
  assert.equal(session.state.phase, "ended");
  const { createServerSignerVerifier } = await import("../server/ranked/verifier.ts");
  const { buildEvidence } = await import("../chain/evidence.ts");
  const verifier = await createServerSignerVerifier({ secretHex: "07".repeat(32), contractId: CONTRACT, buildEvidence, loadWorld: () => fixture });
  const signed = await verifier.verify((await contract.getLife(session.life.life_id))!, JSON.parse(session.save()) as SaveFile);
  return { contract, session, storage, options, signed, action: NPC_ACTIONS[signed.evidence.career_group].actions[0] };
}

test("a committed mint resumes after reload without verification, replay or another mint fee", async () => {
  const { contract, session, storage, options, signed, action } = await finishedSmallLife();
  let initialCalls = 0, retries = 0, committed = false;
  const wrapped = Object.create(contract) as typeof contract;
  wrapped.getLife = async lifeId => {
    const life = await contract.getLife(lifeId);
    return life && committed && life.status === "alive" ? { ...life, status: "minting" } : life;
  };
  wrapped.mintLife = async () => {
    initialCalls++;
    committed = true;
    throw new Error("The resolver was interrupted after the mint fee committed");
  };
  wrapped.retryMint = async lifeId => {
    assert.equal(lifeId, session.life.life_id);
    retries++;
    return contract.mintLife(lifeId, signed, action);
  };
  (session as unknown as { options: { contract: typeof contract } }).options.contract = wrapped;
  await assert.rejects(session.mint(signed, action), /resolver was interrupted/);
  assert.equal(session.life.status, "minting");
  const saved = storage.getItem(`everfolk.ranked.${session.life.life_id}`);
  assert.ok(saved, "finished progress stays saved while the mint is pending");

  const resumed = await resumeRankedSession({ ...options, contract: wrapped }, session.life.life_id);
  assert.equal(resumed.life.status, "minting");
  assert.equal(resumed.state.phase, "ended");
  assert.equal(resumed.save(), saved);
  await assert.rejects(resumed.dispatch({ type: "advance" }), /mint is already committed/);
  await assert.rejects(resumed.finish((async () => { throw new Error("The verifier must not be called again"); }) as typeof fetch), /Complete the mint instead/);
  const result = await resumed.recoverMint();
  assert.equal(initialCalls, 1, "only the original request paid the mint fee");
  assert.equal(retries, 1);
  assert.equal(resumed.life.status, "minted");
  assert.equal((await contract.mintResult(session.life.life_id))?.token_id, result.token_id);
  assert.equal(storage.getItem(`everfolk.ranked.${session.life.life_id}`), null);
});

test("a completed mint can be recovered after reload when local save cleanup was interrupted", async () => {
  const { contract, session, storage, options, signed, action } = await finishedSmallLife();
  const saved = session.save();
  const minted = await contract.mintLife(session.life.life_id, signed, action);
  storage.setItem(`everfolk.ranked.${session.life.life_id}`, saved);
  const resumed = await resumeRankedSession(options, session.life.life_id);
  contract.retryMint = async () => { throw new Error("An already complete mint must not send another transaction"); };
  assert.deepEqual(await resumed.recoverMint(), minted);
  assert.equal(storage.getItem(`everfolk.ranked.${session.life.life_id}`), null);
});

test("a pending mint with no local save is never started again as a new playable life", async () => {
  const contract = createMockContract({ genesis: false });
  const life = await contract.startLife("alexandria-ranked-1");
  await assert.rejects(beginRankedSession({ contract, contractId: CONTRACT, verifyUrl: "x", world: smallRankedWorld(), storage: memoryStorage() }, { ...life, status: "minting" }), /committed mint/);
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

test("a completed unminted save is recognized as ended when the chain still calls it alive", async () => {
  const { rankedProgress } = await import("../client/chain/ranked-progress.ts");
  const { session, storage } = await start();
  await playUntil(session, () => false, 20000);
  assert.equal(session.state.phase, "ended");
  assert.equal(session.life.status, "alive");
  const progress = await rankedProgress(session.life, storage, world);
  assert.equal(progress.status, "ended");
  assert.equal(progress.age, session.state.age);
  const wrong = await rankedProgress({ ...session.life, seed: "0".repeat(64) }, storage, world);
  assert.equal(wrong.status, "unavailable", "a save from a different deployment cannot masquerade as a finished life");
});

test("verifiable life history checks both evidence and choices before displaying them", async () => {
  const { verifiedLifeChoices } = await import("../client/chain/life-choices.ts");
  const { canonicalJson } = await import("../src/random.ts");
  const { sha256Hex } = await import("../chain/hash.ts");
  const { buildEvidence } = await import("../chain/evidence.ts");
  const { session } = await start();
  await playUntil(session, () => false, 20000);
  const save = JSON.parse(session.save()) as SaveFile;
  const evidence = await buildEvidence({ life: session.life, state: session.state, save, worldFingerprint: session.state.worldFingerprint });
  const hash = await sha256Hex(canonicalJson(evidence));
  const response = (data: unknown) => (async () => new Response(JSON.stringify(data))) as typeof fetch;
  const rows = await verifiedLifeChoices(hash, response({ evidence, save }), world);
  assert.ok(rows.some(row => row.type === "choice"));
  assert.ok(rows.some(row => row.type === "ending"));
  await assert.rejects(verifiedLifeChoices(hash, response({ evidence: { ...evidence, death_age: 999 }, save }), world), /on-chain evidence hash/);
  await assert.rejects(verifiedLifeChoices(hash, response({ evidence, save: { ...save, commands: [] } }), world), /on-chain evidence hash/);
});
