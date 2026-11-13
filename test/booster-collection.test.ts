import assert from "node:assert/strict";
import test from "node:test";
import { BOOSTER_COLLECTION_KEY, readBoosterCollection, resolveBoosterPack } from "../client/storage/booster-collection.ts";
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
  resolveBoosterPack(storage, pack("skipped-life", [0, 4]));
  assert.deepEqual(readBoosterCollection(storage)[0].selected, []);
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
