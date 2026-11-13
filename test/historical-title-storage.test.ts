import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import { collectLegacyEntries, LEGACY_GALLERY_KEY, persistLegacyEntries, readLegacyEntries } from "../client/storage/legacy-store.ts";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

function fixture(figure = true): WorldPack {
  return {
    schemaVersion: 1, id: "historical-card-storage", version: "1", title: "Title card fixture", description: "Synthetic storage test.", startYear: -328, maxAge: 10,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 80 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "A fictional household.", weight: 1, effects: [] }], yearlyEffects: [],
    events: [{ id: "recognition", title: "An accepted review", text: "Alexander reviews completed duties.", trigger: { type: "age", at: 0 },
      choices: [{ id: "accept", text: "Accept recognition", outcomes: [{ id: "recognized", text: "Alexander recognizes your completed duties as Right Hand of Alexander.", weight: 1,
        effects: [{ type: "accomplishment", achievement: "right-hand-of-alexander" }] }] }] }],
    endings: [{ id: "end", title: "End", text: "The fixture ends." }], defaultEnding: "end",
    character: { skills: { oratory: { label: "Oratory", min: 0, max: 100, initial: 40 } }, jobs: [], partners: [],
      activities: [{ id: "rest", text: "Rest", category: "family", outcomes: [{ id: "rested", text: "Rested.", weight: 1, effects: [] }] }],
      childNames: ["Child"], deathCauses: [{ id: "old", title: "Old", text: "Old.", weight: 1 }], deathCauseDescription: "Fictional." },
    legacy: { routes: [{ id: "military", title: "Military", description: "Completed service.", skillIds: ["oratory"], jobIds: [], achievementIds: ["right-hand-of-alexander"] }],
      achievements: [{ id: "right-hand-of-alexander", routeId: "military", title: "Right Hand of Alexander", description: "Recognition after accepted duties.",
        kind: "prestige", nameTemplate: "{name}, Right Hand of Alexander", people: ["Alexander"], evidence: "fictional",
        ...(figure ? { figure: { id: "alexander", name: "Alexander" } } : {}) }] },
  };
}

test("historical title cards preserve figure attribution, provenance and independent collection copies", () => {
  const world = fixture();
  const engine = createEngine(world);
  const life = engine.choose(engine.start("title-card-owner"), "accept");
  const record = life.accomplishments![0];
  assert.deepEqual(record.figure, { id: "alexander", name: "Alexander" });
  assert.equal(record.sourceId, "recognition");
  assert.equal(record.outcomeId, "recognized");
  const disk = storage();
  const entries = collectLegacyEntries(world, life, []);
  persistLegacyEntries(disk, entries);
  const loaded = readLegacyEntries(disk);
  assert.deepEqual(loaded[0].accomplishment, record);
  assert.equal(collectLegacyEntries(world, life, loaded).length, 1, "Reloading a life cannot duplicate its title card.");
  loaded[0].accomplishment.figure!.name = "Changed in the collection copy";
  assert.equal(record.figure!.name, "Alexander");
  assert.equal(world.legacy!.achievements[0].figure!.name, "Alexander");
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("existing cards without historical figures remain readable alongside figure title cards", () => {
  const oldWorld = fixture(false), newWorld = fixture();
  const oldEngine = createEngine(oldWorld), newEngine = createEngine(newWorld);
  const oldLife = oldEngine.choose(oldEngine.start("older-card"), "accept");
  const newLife = newEngine.choose(newEngine.start("newer-card"), "accept");
  const disk = storage();
  const entries = collectLegacyEntries(newWorld, newLife, collectLegacyEntries(oldWorld, oldLife, []));
  persistLegacyEntries(disk, entries);
  const loaded = readLegacyEntries(disk);
  assert.equal(loaded.length, 2);
  assert.equal(Object.hasOwn(loaded[0].accomplishment, "figure"), false);
  assert.equal(loaded[1].accomplishment.figure!.id, "alexander");
});

test("malformed saved figure attribution is rejected without overwriting the saved collection", () => {
  const world = fixture(), engine = createEngine(world);
  const entries = collectLegacyEntries(world, engine.choose(engine.start("corrupt-figure"), "accept"), []);
  for (const bad of [null, "Alexander", { id: "alexander" }, { id: "alexander", name: 42 }, { id: "", name: "Alexander" }]) {
    const malformed = structuredClone(entries) as unknown as { accomplishment: { figure: unknown } }[];
    malformed[0].accomplishment.figure = bad;
    const serialized = JSON.stringify(malformed), disk = storage();
    disk.setItem(LEGACY_GALLERY_KEY, serialized);
    assert.throws(() => readLegacyEntries(disk), /left unchanged/);
    assert.equal(disk.getItem(LEGACY_GALLERY_KEY), serialized);
  }
});

test("figure attribution persists independently of the people who reviewed the work", () => {
  const world = fixture();
  world.legacy!.achievements[0].people = ["Fellow readers"];
  world.events[0].choices[0].outcomes[0].text = "Fellow readers recognize the work in Alexander's tradition.";
  validateWorld(world);
  const engine = createEngine(world);
  const life = engine.choose(engine.start("independent-readers"), "accept");
  const entries = collectLegacyEntries(world, life, []);
  const disk = storage();
  persistLegacyEntries(disk, entries);
  const saved = readLegacyEntries(disk)[0].accomplishment;
  assert.deepEqual(saved.figure, { id: "alexander", name: "Alexander" });
  assert.deepEqual(saved.people, ["Fellow readers"]);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("world validation rejects malformed or inconsistently named historical figures", () => {
  for (const figure of [null, { id: "Alexander!", name: "Alexander" }, { id: "alexander", name: "" }]) {
    const world = fixture();
    (world.legacy!.achievements[0] as unknown as { figure: unknown }).figure = figure;
    assert.throws(() => validateWorld(world), /figure/);
  }
  const inconsistent = fixture();
  const first = inconsistent.legacy!.achievements[0];
  inconsistent.legacy!.achievements.push({ ...first, id: "another-title", people: ["Another name"], figure: { id: "alexander", name: "Another name" } });
  inconsistent.legacy!.routes[0].achievementIds.push("another-title");
  assert.throws(() => validateWorld(inconsistent), /historical figure names must be consistent/);
});
