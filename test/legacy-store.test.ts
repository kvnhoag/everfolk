import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import { attachLegacyNft, collectLegacyEntries, LEGACY_GALLERY_KEY, persistLegacyEntries, readLegacyEntries, safeExplorerUrl } from "../client/storage/legacy-store.ts";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
function world(): WorldPack {
  return {
    schemaVersion: 1, id: "gallery-fixture", version: "1", title: "A world", description: "A synthetic fixture.", startYear: -66, maxAge: 100,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 80 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "A home.", weight: 1, effects: [] }], yearlyEffects: [],
    events: [{ id: "first-work", title: "A work", text: "Make something.", trigger: { type: "age", at: 0 }, choices: [{ id: "make", text: "Make it", outcomes: [{ id: "made", text: "Damon accepts the figure.", weight: 1, effects: [{ type: "accomplishment", achievement: "first-work" }] }] }] }],
    endings: [{ id: "end", title: "End", text: "End.", kind: "death" }], defaultEnding: "end",
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [], activities: [{ id: "rest", text: "Rest", category: "family", outcomes: [{ id: "rested", text: "Rested.", weight: 1, effects: [] }] }], childNames: ["Child"], deathCauses: [{ id: "old", title: "Old", text: "Old.", weight: 1 }], deathCauseDescription: "Fictional." },
    legacy: { routes: [{ id: "sculpture", title: "Sculpture", description: "Make figures.", skillIds: ["craft"], jobIds: [], achievementIds: ["first-work"] }], achievements: [{ id: "first-work", routeId: "sculpture", title: "First work", description: "A real accomplished outcome.", kind: "ordinary", nameTemplate: "A figure by {name}", people: ["Damon"], evidence: "fictional" }] },
  };
}
const pack = world();
const engine = createEngine(pack);
const accomplished = (seed: string) => engine.choose(engine.start(seed), "make");

test("the separate gallery retains accomplishments from more than ten lives and deduplicates reloads", () => {
  const disk = storage();
  let entries = readLegacyEntries(disk);
  for (let i = 0; i < 12; i++) entries = collectLegacyEntries(pack, accomplished(`life-${i}`), entries);
  persistLegacyEntries(disk, entries);
  assert.equal(readLegacyEntries(disk).length, 12);
  const last = accomplished("life-11");
  const reloaded = collectLegacyEntries(pack, last, readLegacyEntries(disk));
  assert.equal(reloaded.length, 12);
  assert.deepEqual(reloaded.at(-1)!.accomplishment, last.accomplishments![0]);
  assert.equal(last.commands.length, 1, "collection never mutates the accepted simulation history");
});

test("NFT receipts survive a life refresh and galleries do not alias mutable source objects", () => {
  const life = accomplished("receipt-life");
  const entries = collectLegacyEntries(pack, life, [], "verified-run");
  const receipt = { tokenId: "token-1", explorerUrl: "https://testnet.nearblocks.io/nft-token/contract/token-1" };
  const minted = attachLegacyNft(entries, entries[0].key, receipt);
  const refreshed = collectLegacyEntries(pack, life, minted);
  assert.deepEqual(refreshed[0].nft, receipt);
  assert.equal(refreshed[0].verifiedRunId, "verified-run");
  refreshed[0].accomplishment.people.push("Changed only in the UI");
  assert.deepEqual(life.accomplishments![0].people, ["Damon"]);
  assert.equal(entries[0].nft, undefined);
});

test("corrupt saved galleries remain untouched and unsafe explorer links are rejected", () => {
  const disk = storage();
  disk.setItem(LEGACY_GALLERY_KEY, "not-json");
  assert.throws(() => readLegacyEntries(disk), /left unchanged/);
  assert.equal(disk.getItem(LEGACY_GALLERY_KEY), "not-json");
  assert.equal(safeExplorerUrl("javascript:alert(1)"), undefined);
  assert.equal(safeExplorerUrl("https://user:secret@example.com"), undefined);
  const entries = collectLegacyEntries(pack, accomplished("bad-receipt"), []);
  assert.throws(() => attachLegacyNft(entries, entries[0].key, { tokenId: "x", explorerUrl: "javascript:alert(1)" }), /valid explorer/);
});

test("old packs add no fabricated achievements and blocked storage reports failure", () => {
  const old = world();
  delete old.legacy;
  old.events[0].choices[0].outcomes[0].effects = [];
  const oldEngine = createEngine(old);
  assert.deepEqual(collectLegacyEntries(old, oldEngine.start("old"), []), []);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() {} };
  assert.throws(() => readLegacyEntries(blocked), /cannot access/);
  assert.throws(() => persistLegacyEntries(blocked, collectLegacyEntries(pack, accomplished("quota"), [])), /could not save/);
});
