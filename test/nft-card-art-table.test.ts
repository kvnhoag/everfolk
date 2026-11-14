import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCardArtTable } from "../chain/card-art.ts";
import { reachableEarnedCardIds } from "../chain/earned-cards.ts";
import { RARITY_CAPS } from "../chain/rarity-caps.ts";
import type { WorldPack } from "../src/types.ts";
import lives11 from "../worlds/demo/alexandria-lives-11.json" with { type: "json" };

const manifest = JSON.parse(readFileSync(new URL("../public/assets/cards/collection-v14/manifest.json", import.meta.url), "utf8"));
const world = lives11 as unknown as WorldPack;
const table = buildCardArtTable(manifest, "https://everfolk.life", world);

test("the contract's card table lists exactly the cards a Weave life can earn, with absolute images", () => {
  assert.deepEqual(table.map(entry => entry.card_id).sort(), reachableEarnedCardIds(world).sort());
  for (const entry of table) {
    assert.match(entry.media, /^https:\/\/everfolk\.life\/assets\/cards\/collection-v14\/[a-z0-9-]+-footerless\.webp$/);
    assert.ok(entry.title.length > 2 && entry.title.length <= 64, entry.card_id);
    assert.equal(entry.edition_limit, RARITY_CAPS[entry.rarity]);
    assert.deepEqual(Object.keys(entry).sort(), ["card_id", "edition_limit", "media", "rarity", "title"]);
  }
  const byId = new Map(table.map(entry => [entry.card_id, entry]));
  assert.deepEqual([byId.get("alexander-parent")?.title, byId.get("alexander-parent")?.rarity], ["Alexander the Great", 4]);
  assert.deepEqual([byId.get("cleomenes-parent")?.rarity, byId.get("ptolemy-parent-legendary")?.rarity], [3, 4]);
  assert.equal(byId.get("alexander-common-male")?.title, "Campaign Soldier");
  assert.ok(table.every(entry => entry.rarity < 4 || /-parent(-legendary)?$/.test(entry.card_id)), "only historical figures are Legendary");
});

test("the table rejects a relative image base, which wallets cannot load", () => {
  assert.throws(() => buildCardArtTable(manifest, "/assets", world), /absolute https/);
  assert.ok(buildCardArtTable(manifest, "https://cdn.example/x/", world)[0].media.startsWith("https://cdn.example/x/assets/"));
});
