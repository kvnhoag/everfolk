import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { canonicalJson } from "../src/random.ts";
import type { Command, InfluenceEntry, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-0.33.0.json" with { type: "json" };

type Influence = Extract<Command, { type: "influence" }>;

const SOURCE = { contractId: "everfolk-lives.testnet", tokenId: "7" };
const OTHER_SOURCE = { contractId: "everfolk-lives.testnet", tokenId: "12" };

const INFLUENCES: InfluenceEntry[] = [
  { id: "letters.teach", label: "Teach the young", baseWeight: 1, effects: [
    { type: "stat", stat: "knowledge", delta: 5 },
    { type: "stat", stat: "health", delta: -3 },
  ] },
  { id: "aristotle.lyceum", label: "Found the Lyceum", baseWeight: 3, event: {
    id: "lyceum-lecture", title: "A lecture in the Lyceum", text: "A teacher walks and talks with the young.",
    trigger: { type: "age", at: 2 },
    choices: [{ id: "listen", text: "Listen", outcomes: [{ id: "listened", text: "You learn.", weight: 1, effects: [{ type: "stat", stat: "knowledge", delta: 4 }] }] }],
  } },
  { id: "alexander.levy", label: "Levy the city", baseWeight: 5, event: {
    id: "levy-call", title: "The levy", text: "Recruiters come for the young.",
    trigger: { type: "random", weight: 1 },
    choices: [
      { id: "serve", text: "Serve", outcomes: [{ id: "served", text: "You march.", weight: 1, effects: [{ type: "stat", stat: "health", delta: -10 }] }] },
      { id: "flee", text: "Flee", outcomes: [{ id: "fled", text: "You hide.", weight: 1, effects: [] }] },
    ],
  } },
];

function world(influences: InfluenceEntry[] | null = INFLUENCES): WorldPack {
  return {
    schemaVersion: 1, id: "influence-test", version: "1", title: "Influence test", description: "Fictional test data.",
    startYear: 1, maxAge: 10,
    stats: {
      knowledge: { label: "Knowledge", min: 0, max: 100, initial: 10 },
      health: { label: "Health", min: 0, max: 100, initial: 50 },
    },
    flags: {},
    origins: [{ id: "commoner", title: "Commoner", text: "Born in the city.", weight: 1, effects: [] }],
    yearlyEffects: [],
    events: [{
      id: "first-choice", title: "First choice", text: "A household decision.", trigger: { type: "age", at: 0 },
      choices: [{ id: "wait", text: "Wait", outcomes: [{ id: "waited", text: "Time passes.", weight: 1, effects: [] }] }],
    }],
    endings: [{ id: "complete", title: "Complete", text: "Life complete." }],
    defaultEnding: "complete",
    ...(influences ? { influences } : {}),
  };
}

function command(entry: string, mode: Influence["mode"], power = 1, source = SOURCE): Influence {
  return { type: "influence", source, entry, power, mode };
}

function untilChoice(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "ready") life = engine.advance(life);
  return life;
}

test("apply scales stat deltas by power", () => {
  const engine = createEngine(world());
  const life = engine.start("scale");
  const applied = engine.influence(life, command("letters.teach", "apply", 1.5));
  // 5 × 1.5 = 7.5 → 7 and −3 × 1.5 = −4.5 → −4 (rounded toward zero).
  assert.equal(applied.stats.knowledge, life.stats.knowledge + 7);
  assert.equal(applied.stats.health, life.stats.health - 4);
  assert.deepEqual(applied.commands.at(-1), command("letters.teach", "apply", 1.5));
  assert.equal(life.stats.knowledge, 10, "the input snapshot is not mutated");
});

test("apply journals source and deltas", () => {
  const engine = createEngine(world());
  const applied = engine.influence(engine.start("journal"), command("letters.teach", "apply", 2));
  const entry = applied.journal.at(-1)!;
  assert.equal(entry.type, "influence");
  assert.equal(entry.id, "letters.teach");
  assert.deepEqual(entry.source, SOURCE);
  assert.deepEqual(entry.deltas, { knowledge: 10, health: -6 });
  assert.equal(entry.age, 0);
});

test("activate adds event that fires with source", () => {
  const engine = createEngine(world());
  const plain = untilChoice(engine, engine.choose(engine.start("activate"), "wait"));
  assert.equal(plain.phase, "ended", "an inactive influence event never joins the pool");
  assert.equal(plain.journal.some(entry => entry.id === "lyceum-lecture"), false);

  let life = engine.influence(engine.start("activate"), command("aristotle.lyceum", "activate", 1.5));
  assert.deepEqual(life.activeInfluences, [{ entry: "aristotle.lyceum", source: SOURCE, power: 1.5 }]);
  assert.equal(life.journal.some(entry => entry.source), false, "activation alone is not a firing");
  life = untilChoice(engine, engine.choose(life, "wait"));
  assert.equal(life.pendingEventId, "lyceum-lecture");
  assert.equal(life.age, 2);
  const fired = life.journal.filter(entry => entry.source);
  assert.equal(fired.length, 1);
  assert.equal(fired[0].type, "event");
  assert.equal(fired[0].id, "lyceum-lecture");
  assert.deepEqual(fired[0].source, SOURCE);
  life = engine.choose(life, "listen");
  assert.equal(life.journal.filter(entry => entry.source).length, 1, "one sourced entry per firing");
});

test("apply with event queues it after current choice", () => {
  const engine = createEngine(world());
  const start = engine.start("queue");
  assert.equal(start.pendingEventId, "first-choice");
  let life = engine.influence(start, command("alexander.levy", "apply", 2, OTHER_SOURCE));
  assert.equal(life.pendingEventId, "first-choice", "the current decision is not displaced");
  assert.deepEqual(life.journal.at(-1), { type: "influence", id: "alexander.levy", text: "Levy the city", age: 0, year: 1, source: OTHER_SOURCE, deltas: {} });
  life = engine.choose(life, "wait");
  assert.equal(life.phase, "choice");
  assert.equal(life.pendingEventId, "levy-call");
  const fired = life.journal.at(-1)!;
  assert.equal(fired.type, "event");
  assert.deepEqual(fired.source, OTHER_SOURCE);
  life = engine.choose(life, "flee");
  assert.equal(life.phase, "ready");
  assert.equal(life.queuedInfluences, undefined);

  // With no decision pending, the queued event is offered at once.
  const ready = engine.choose(engine.start("queue"), "wait");
  const immediate = engine.influence(ready, command("alexander.levy", "apply"));
  assert.equal(immediate.pendingEventId, "levy-call");
});

test("unknown entry rejected", () => {
  const engine = createEngine(world());
  const life = engine.start("unknown");
  assert.throws(() => engine.influence(life, command("nobody.nothing", "apply")), /Unknown influence entry/);
  assert.throws(() => engine.replay("unknown", [command("nobody.nothing", "activate")]), /Unknown influence entry/);
  const bare = createEngine(world(null));
  assert.throws(() => bare.influence(bare.start("unknown"), command("letters.teach", "apply")), /Unknown influence entry: letters\.teach/);
});

test("replay with influence commands is deterministic", () => {
  const engine = createEngine(world());
  let life = engine.start("replay");
  life = engine.influence(life, command("aristotle.lyceum", "activate", 3));
  life = engine.influence(life, command("letters.teach", "apply", 1.25, OTHER_SOURCE));
  life = engine.influence(life, command("alexander.levy", "apply", 2));
  life = engine.choose(life, "wait");
  life = engine.choose(life, "serve");
  life = untilChoice(engine, life);
  life = engine.choose(life, "listen");
  const first = engine.replay(life.seed, life.commands);
  const second = engine.replay(life.seed, structuredClone(life.commands));
  assert.equal(engine.save(first), engine.save(second));
  assert.deepEqual(first, life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("worlds without influences behave exactly as before", () => {
  // Hashes pinned from the engine before the influence command existed.
  const expected = {
    "influence-baseline-1": ["0efd3c337bf9ab6634f6e922898d8a603b73ac696c974ae7c2f90a0a03e908fb", "30ca4f318b94a88ee49675299c97a2416a5fec44e3c105875d8dfcabf00f340c"],
    "influence-baseline-2": ["8cb665dd75de94ea148c074e26cfef4d58450b255d9a4068c956a372da5f02c6", "d708a313e03c4cf04861ef01b54a92b2dd6bfd10fe5b822660ee768cb6fd86f8"],
  };
  const engine = createEngine(current);
  assert.equal(engine.fingerprint, "fnv1a64-168b4fa7b12a1e9d");
  const sha = (text: string) => createHash("sha256").update(text).digest("hex");
  for (const [seed, [saveHash, stateHash]] of Object.entries(expected)) {
    let life = engine.start(seed);
    while (life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
    const save = engine.save(life);
    assert.equal(sha(save), saveHash);
    assert.equal(sha(canonicalJson(life)), stateHash);
    assert.equal(sha(canonicalJson(engine.load(save))), stateHash);
    assert.equal("activeInfluences" in life || "queuedInfluences" in life, false);
  }
});

test("fingerprint changes when influences change", () => {
  const base = createEngine(world(null)).fingerprint;
  const withCatalog = createEngine(world()).fingerprint;
  const relabelled = createEngine(world([{ ...INFLUENCES[0], label: "Teach the very young" }, ...INFLUENCES.slice(1)])).fingerprint;
  const reweighted = createEngine(world([{ ...INFLUENCES[0], baseWeight: 3 }, ...INFLUENCES.slice(1)])).fingerprint;
  assert.equal(new Set([base, withCatalog, relabelled, reweighted]).size, 4);
  const engine = createEngine(world());
  const life = engine.start("pinned");
  assert.throws(() => createEngine(world([{ ...INFLUENCES[0], label: "Changed" }, ...INFLUENCES.slice(1)])).load(engine.save(life)), /different world/);
});

test("influence is rejected after death and with a malformed shape", () => {
  const engine = createEngine(world());
  let life = engine.choose(engine.start("ended"), "wait");
  while (life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  assert.throws(() => engine.influence(life, command("letters.teach", "apply")), /This life has ended/);
  const ok = command("letters.teach", "apply");
  const malformed: unknown[] = [
    { ...ok, power: 0 }, { ...ok, power: -1 }, { ...ok, power: Number.NaN }, { ...ok, power: 11 },
    { ...ok, mode: "boost" }, { ...ok, source: { contractId: "", tokenId: "7" } },
    { ...ok, source: { ...SOURCE, extra: 1 } }, { ...ok, extra: true }, { ...ok, entry: 4 },
  ];
  for (const bad of malformed) {
    assert.throws(() => engine.influence(engine.start("bad"), bad as Influence), /Invalid influence command/);
    assert.throws(() => engine.replay("bad", [bad as Command]), /Invalid (influence )?command/);
  }
});

test("validation rejects malformed influence catalogs", () => {
  const cases: [unknown, RegExp][] = [
    [{ ...INFLUENCES[0], baseWeight: 2 }, /influences\[0\]\.baseWeight: expected 1, 3 or 5/],
    [{ ...INFLUENCES[0], label: "" }, /influences\[0\]\.label/],
    [{ ...INFLUENCES[0], id: "Letters Teach" }, /influences\[0\]\.id/],
    [{ ...INFLUENCES[0], effects: [{ type: "stat", stat: "luck", delta: 1 }] }, /influences\[0\]\.effects\[0\]\.stat: unknown stat 'luck'/],
    [{ ...INFLUENCES[0], extra: true }, /influences\[0\]\.extra: unknown field/],
    [{ id: "empty.entry", label: "Nothing", baseWeight: 1 }, /influences\[0\]: an influence entry needs effects or an event/],
    [{ ...INFLUENCES[1], event: { ...INFLUENCES[1].event!, id: "first-choice" } }, /influences\[0\]\.event\.id: duplicate event ID 'first-choice'/],
    [{ ...INFLUENCES[1], event: { ...INFLUENCES[1].event!, trigger: { type: "age", at: 99 } } }, /influences\[0\]\.event\.trigger\.at/],
  ];
  for (const [entry, message] of cases) assert.throws(() => createEngine(world([entry as InfluenceEntry])), message);
  assert.throws(() => createEngine(world([INFLUENCES[0], INFLUENCES[0]])), /influences\[1\]\.id: duplicate ID 'letters\.teach'/);
  assert.throws(() => createEngine({ ...world(), influences: {} }), /world\.influences: expected a JSON array/);
  assert.doesNotThrow(() => createEngine(world([])));
});

test("ranked activations precede the avatar choice and scale skills in a real world", () => {
  const pack = structuredClone(current) as WorldPack;
  pack.influences = [{ id: "letters.lend-books", label: "Lend books", baseWeight: 1, effects: [{ type: "skill", skill: "literacy", delta: 3 }] }];
  const engine = createEngine(pack);
  let life = engine.start("ranked-avatar");
  life = engine.influence(life, command("letters.lend-books", "activate", 1.5));
  const chosen = engine.chooseAvatar(life, (life.character!.avatarVariant! + 1) % 3);
  assert.equal(chosen.commands.at(-1)!.type, "avatar");
  const applied = engine.influence(chosen, command("letters.lend-books", "apply", 2));
  const skill = applied.journal.at(-1)!.deltas!["skill:literacy"];
  assert.equal(applied.character!.skills.literacy - chosen.character!.skills.literacy, skill);
  assert.ok(skill > 0);
  assert.deepEqual(engine.replay(applied.seed, applied.commands), applied);
});

test("paced worlds queue applied events after the decision and draw activated ones with source", () => {
  const pack = structuredClone(current) as WorldPack;
  const choices = [{ id: "heed", text: "Heed", outcomes: [{ id: "heeded", text: "You listen.", weight: 1, effects: [] }] }];
  pack.influences = [
    { id: "sky.warn-year", label: "Warn of a bad year", baseWeight: 1, event: { id: "sky-warning", title: "A warning", text: "An astrologer warns you.", trigger: { type: "random", weight: 1 }, choices } },
    { id: "sky.omen", label: "Cast a favourable omen", baseWeight: 3, event: { id: "sky-omen", title: "An omen", text: "A favourable sign.", trigger: { type: "random", weight: 1_000_000 }, choices } },
  ];
  const engine = createEngine(pack);
  const play = (life: LifeState, stop: (life: LifeState) => boolean) => {
    while (life.phase !== "ended" && !stop(life)) life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
    return life;
  };
  let life = play(engine.start("paced-queue"), state => state.phase === "choice" && state.age > 0);
  const pending = life.pendingEventId;
  life = engine.influence(life, command("sky.warn-year", "apply", 1.25));
  assert.equal(life.pendingEventId, pending);
  life = engine.choose(life, engine.getChoices(life)[0].id);
  assert.equal(life.pendingEventId, "sky-warning");
  assert.deepEqual(life.journal.at(-1)!.source, SOURCE);

  const free = play(engine.start("paced-pool"), () => false);
  assert.equal(free.journal.some(entry => entry.id === "sky-omen"), false);
  let ranked = engine.influence(engine.start("paced-pool"), command("sky.omen", "activate", 2, OTHER_SOURCE));
  ranked = play(ranked, state => state.pendingEventId === "sky-omen");
  assert.equal(ranked.pendingEventId, "sky-omen");
  assert.deepEqual(ranked.journal.filter(entry => entry.source).map(entry => [entry.type, entry.id, entry.source]), [["event", "sky-omen", OTHER_SOURCE]]);
  assert.deepEqual(engine.replay(ranked.seed, ranked.commands), ranked);
});
