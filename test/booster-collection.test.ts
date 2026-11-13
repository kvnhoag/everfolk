import assert from "node:assert/strict";
import test from "node:test";
import { BOOSTER_COLLECTION_KEY, BoosterDecisionConflictError, readBoosterCollection, resolveBoosterPack } from "../client/storage/booster-collection.ts";
import type { BoosterCollectionPack } from "../client/types/booster.ts";

function memory() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
const cards = Array.from({ length: 5 }, (_, index) => ({ name: `Card ${index}`, rarity: index, art: "/assets/figures/euclid.png", sub: "Open a school" }));
const pack = (id: string, selected: number[]): BoosterCollectionPack => ({ id, lifeKey: id, characterName: "Demetrios", cards, selected });

test("any subset of one to five cards survives rereading without duplicate grants", () => {
  const storage = memory();
  for (let count = 1; count <= 5; count++) {
    const selected = Array.from({ length: count }, (_, index) => index);
    resolveBoosterPack(storage, pack(`life-${count}`, selected));
    resolveBoosterPack(storage, pack(`life-${count}`, selected));
  }
  const saved = readBoosterCollection(storage);
  assert.deepEqual(saved.map(entry => entry.selected.length), [1, 2, 3, 4, 5]);
  assert.deepEqual(saved[4].cards, cards);
});

test("skip records an empty decision and reopening cannot grant a different selection", () => {
  const storage = memory();
  resolveBoosterPack(storage, pack("skipped-life", []));
  assert.throws(() => resolveBoosterPack(storage, pack("skipped-life", [0, 4])), BoosterDecisionConflictError);
  assert.deepEqual(readBoosterCollection(storage)[0].selected, []);
});

test("a stale tab cannot report a different saved selection as successful", () => {
  const storage = memory();
  resolveBoosterPack(storage, pack("kept-life", [4, 0]));
  const original = storage.getItem(BOOSTER_COLLECTION_KEY);
  assert.throws(() => resolveBoosterPack(storage, pack("kept-life", [2])), BoosterDecisionConflictError);
  assert.throws(() => resolveBoosterPack(storage, pack("kept-life", [])), BoosterDecisionConflictError);
  assert.equal(storage.getItem(BOOSTER_COLLECTION_KEY), original);
  assert.deepEqual(readBoosterCollection(storage)[0].selected, [0, 4]);
  assert.doesNotThrow(() => resolveBoosterPack(storage, pack("kept-life", [0, 4])));
  assert.doesNotThrow(() => resolveBoosterPack(storage, pack("kept-life", [4, 0])));
  assert.equal(readBoosterCollection(storage).length, 1);
});

test("malformed, duplicate and out-of-range selections never overwrite a collection", () => {
  const storage = memory();
  for (const selected of [[-1], [5], [1, 1], [0.5]]) assert.throws(() => resolveBoosterPack(storage, pack("bad", selected)));
  assert.equal(storage.getItem(BOOSTER_COLLECTION_KEY), null);
  storage.setItem(BOOSTER_COLLECTION_KEY, "{broken");
  assert.throws(() => resolveBoosterPack(storage, pack("new", [1])));
  assert.equal(storage.getItem(BOOSTER_COLLECTION_KEY), "{broken");
  storage.setItem(BOOSTER_COLLECTION_KEY, JSON.stringify([pack("unsafe", [0])].map(entry => ({ ...entry, cards: [{ ...cards[0], art: "https://example.com/tracker.png" }] }))));
  assert.throws(() => readBoosterCollection(storage));
});

test("approved framed cards retain their serial and coexist with older saved packs", () => {
  const storage = memory();
  resolveBoosterPack(storage, pack("old-life", [0]));
  const framed = { ...cards[0], art: "/assets/cards/collection-v14/portraits/euclid-parent.webp", framedArt: "/assets/cards/collection-v14/euclid-parent-footerless.webp", editionText: "—/010" };
  resolveBoosterPack(storage, { ...pack("new-life", [0]), cards: [framed] });
  const saved = readBoosterCollection(storage);
  assert.deepEqual(saved[0].cards, cards);
  assert.deepEqual(saved[1].cards, [framed]);
  assert.deepEqual(saved.map(entry => entry.selected), [[0], [0]]);
});

test("unsafe framed image URLs and prose masquerading as copy serials do not enter the collection", () => {
  const storage = memory();
  for (const fields of [{ framedArt: "https://example.com/card.webp" }, { framedArt: "/assets/cards/collection-v14/../outside.webp" }, { editionText: "001/025 <script>" }]) {
    assert.throws(() => resolveBoosterPack(storage, { ...pack("bad-framed", [0]), cards: [{ ...cards[0], ...fields }] }));
  }
  assert.equal(storage.getItem(BOOSTER_COLLECTION_KEY), null);
});
