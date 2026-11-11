import assert from "node:assert/strict";
import test from "node:test";
import type { Listing, TokenExtra } from "../chain/types.ts";
import { formatNear, parseNearInput } from "../client/chain/near-amount.ts";
import { marketRows, reachLine, tokenActionMenu, tokenPageView, tokenTitle } from "../client/chain/token-page-model.ts";
import type { TokenView } from "../client/chain/types.ts";

const NEAR = 10n ** 24n;
const extra = (patch: Partial<TokenExtra> = {}): TokenExtra => ({
  kind: "npc", figure_id: null, rarity: 1, affection: 70, action_id: "letters.teach", life_id: "4", birth_year: -350, death_year: -289,
  career_group: "letters", sources: [{ token_id: "1", bps: 6667 }, { token_id: "2", bps: 3333 }], evidence_hash: "e".repeat(64), ...patch,
});
const scholar: TokenView = { owner_id: "alice.testnet", extra: extra() };
const euclid: TokenView = { owner_id: "bob.testnet", extra: extra({ kind: "figure", figure_id: "euclid", rarity: 2, action_id: "euclid.museum", career_group: "letters" }) };
const stats = { lives_influenced: 3, earned: ((3n * NEAR) / 2n).toString() };
const base = { tokenId: "5", token: scholar, stats, viewer: null, balance: "0", listing: null, children: [], sourceTokens: {} };

test("reach line counts lives and earnings", () => {
  assert.equal(reachLine(stats), "Affected 3 lives · earned 1.5 NEAR");
  assert.equal(reachLine({ lives_influenced: 1, earned: (NEAR / 2n).toString() }), "Affected 1 life · earned 0.5 NEAR");
  assert.equal(reachLine({ lives_influenced: 0, earned: "0" }), "Affected 0 lives · earned 0 NEAR");
});

test("titles for figures and people of the city", () => {
  assert.equal(tokenTitle(euclid.extra), "Euclid, the geometer");
  assert.equal(tokenTitle(scholar.extra), "Scholar of Alexandria");
});

test("action menu marks the current action and stays on the token's menu", () => {
  assert.deepEqual(tokenActionMenu(scholar.extra).map(option => [option.id, option.selected]), [["letters.teach", true], ["letters.lend-books", false]]);
  assert.deepEqual(tokenActionMenu(euclid.extra).map(option => [option.id, option.selected]), [["euclid.school", false], ["euclid.museum", true]]);
});

test("owner sees claimable balance, action change and listing controls", () => {
  const view = tokenPageView({ ...base, viewer: "alice.testnet", balance: (NEAR / 4n).toString() });
  assert.equal(view.isOwner, true);
  assert.equal(view.claimableText, "0.25 NEAR");
  assert.equal(view.canChangeAction, true);
  assert.equal(view.canList, true);
  assert.equal(view.canUnlist, false);
  assert.equal(view.canBuy, false);
  assert.equal(view.reach, "Affected 3 lives · earned 1.5 NEAR");
  assert.equal(view.currentAction.name, "Teach the young");
  assert.equal(view.affectionText, "Affection 70 / 100");
  assert.equal(view.rarityLabel, "Uncommon");
});

test("owner with nothing to claim sees no balance", () => {
  assert.equal(tokenPageView({ ...base, viewer: "alice.testnet" }).claimableText, null);
});

test("visitors cannot change the action or see the owner's balance, but can buy a listed token", () => {
  const listing: Listing = { token_id: "5", seller_id: "alice.testnet", price: (2n * NEAR).toString() };
  const view = tokenPageView({ ...base, viewer: "carol.testnet", balance: NEAR.toString(), listing });
  assert.equal(view.isOwner, false);
  assert.equal(view.claimableText, null);
  assert.equal(view.canChangeAction, false);
  assert.equal(view.canBuy, true);
  assert.equal(view.listing?.priceText, "2 NEAR");
  const owner = tokenPageView({ ...base, viewer: "alice.testnet", listing });
  assert.equal(owner.canUnlist, true);
  assert.equal(owner.canList, false);
  assert.equal(owner.canBuy, false);
});

test("sources and lives touched link to their pages", () => {
  const view = tokenPageView({ ...base, children: ["11", "12"], sourceTokens: { "1": euclid, "2": null } });
  assert.deepEqual(view.sources, [
    { tokenId: "1", href: "#token/1", name: "Euclid, the geometer", percentText: "66.67%" },
    { tokenId: "2", href: "#token/2", name: "Token #2", percentText: "33.33%" },
  ]);
  assert.deepEqual(view.children.map(child => child.href), ["#token/11", "#token/12"]);
  assert.equal(view.evidenceHref, `/api/ranked/evidence/${"e".repeat(64)}`);
  assert.equal(tokenPageView({ ...base, token: { ...scholar, extra: extra({ evidence_hash: "0".repeat(64) }) } }).evidenceHref, null);
});

test("market rows name each token and only offer buy to others", () => {
  const listings: Listing[] = [
    { token_id: "5", seller_id: "alice.testnet", price: (2n * NEAR).toString() },
    { token_id: "9", seller_id: "bob.testnet", price: (25n * NEAR / 2n).toString() },
  ];
  const rows = marketRows(listings, { "5": scholar, "9": euclid }, "alice.testnet");
  assert.deepEqual(rows.map(row => [row.tokenId, row.title, row.priceText, row.canBuy, row.isFigure]), [
    ["5", "Scholar of Alexandria", "2 NEAR", false, false],
    ["9", "Euclid, the geometer", "12.5 NEAR", true, true],
  ]);
  assert.equal(rows[1].actionName, "Keep to the Museum");
  assert.deepEqual(marketRows(listings, {}, null).map(row => row.canBuy), [false, false]);
});

test("NEAR amounts format and parse", () => {
  assert.equal(formatNear("0"), "0");
  assert.equal(formatNear("1"), "<0.0001");
  assert.equal(formatNear("123456789000000000000000000"), "123.4567");
  assert.deepEqual(parseNearInput("2.5"), { ok: true, yocto: (5n * NEAR / 2n).toString() });
  assert.deepEqual(parseNearInput(" 3 "), { ok: true, yocto: (3n * NEAR).toString() });
  assert.equal(parseNearInput("0").ok, false);
  assert.equal(parseNearInput("abc").ok, false);
  assert.equal(parseNearInput("-1").ok, false);
});
