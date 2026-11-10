import assert from "node:assert/strict";
import test from "node:test";
import { mintRevealView } from "../client/chain/life-report-model.ts";
import { careerEmblem, keptRows, marketTabs, filterMarket, marketRows } from "../client/chain/token-page-model.ts";
import type { Listing, TokenView } from "../client/chain/types.ts";

const evidence = { birth_year: -350, death_year: -272, death_age: 78, sources: [{ token_id: "2", impact: 45000 }, { token_id: "3", impact: 37500 }, { token_id: "1", impact: 30000 }] };

test("the reveal ledger lists kind, rarity with power, deed, lifespan, sources and NEAR records", () => {
  const view = mintRevealView({ token_id: "4", kind: "figure", figure_id: "euclid", rarity: 2, affection: 61 }, "letters",
    { evidence, actionId: "euclid.school", txHash: "Ab12", evidenceUrl: "https://everfolk.test/api/ranked/evidence/e" });
  const byLabel = Object.fromEntries(view.rows.map(row => [row.label, row]));
  assert.equal(byLabel.Kind.value, "Famous figure");
  assert.equal(byLabel.Rarity.value, "Rare · influence ×1.5");
  assert.equal(byLabel.Deed.value, "Open a school");
  assert.equal(byLabel.Lived.value, "350 BCE – 272 BCE · lived 78 years");
  assert.equal(byLabel["Shaped by"].value, "3 lives");
  assert.deepEqual(byLabel["Shaped by"].chips, ["#2 · 40%", "#3 · 33.33%", "#1 · 26.67%"]);
  assert.deepEqual(view.links, [
    { label: "Mint transaction", href: "https://testnet.nearblocks.io/txns/Ab12" },
    { label: "Verified evidence", href: "https://everfolk.test/api/ranked/evidence/e" },
  ]);
  assert.equal(view.number, "No. 4");
});

test("a reveal without details still names the life and has no empty rows", () => {
  const view = mintRevealView({ token_id: "13", kind: "npc", figure_id: null, rarity: 0, affection: 9 }, "military");
  assert.deepEqual(view.rows.map(row => row.label), ["Kind", "Rarity", "Affection"]);
  assert.equal(view.emblem, "warfare");
  assert.deepEqual(view.links, []);
});

test("each career group has an emblem from the skill icons", () => {
  assert.deepEqual(["letters", "military", "commerce", "craft", "sky", "performance"].map(group => careerEmblem(group as never)),
    ["literacy", "warfare", "reckoning", "craft", "astronomy", "music"]);
});

const token = (kind: "figure" | "npc", figure_id: "euclid" | null, group: "letters" | "craft", affection: number): TokenView => ({
  owner_id: "x.testnet",
  extra: { kind, figure_id, rarity: 1, affection, action_id: kind === "figure" ? "euclid.school" : "craft.apprentice", life_id: "1", birth_year: -350, death_year: -300, career_group: group, sources: [], evidence_hash: "e" },
});
const listings: Listing[] = [
  { token_id: "5", seller_id: "a.testnet", price: "2000000000000000000000000" },
  { token_id: "9", seller_id: "b.testnet", price: "12500000000000000000000000" },
  { token_id: "6", seller_id: "c.testnet", price: "1000000000000000000000000" },
];

test("market rows carry affection and an emblem for people of the city", () => {
  const rows = marketRows(listings, { "5": token("npc", null, "craft", 40), "9": token("figure", "euclid", "letters", 70), "6": token("npc", null, "letters", 10) }, null);
  assert.equal(rows[0].affection, 40);
  assert.equal(rows[0].emblem, "craft");
  assert.equal(rows[1].emblem, null, "figures show their collectible art instead");
});

test("market tabs count each kind and filter the ledger", () => {
  const rows = marketRows(listings, { "5": token("npc", null, "craft", 40), "9": token("figure", "euclid", "letters", 70), "6": token("npc", null, "letters", 10) }, null);
  assert.deepEqual(marketTabs(rows), [
    { id: "all", label: "All", count: 3 },
    { id: "figures", label: "Famous figures", count: 1 },
    { id: "people", label: "People of the city", count: 2 },
  ]);
  assert.deepEqual(filterMarket(rows, "figures").map(row => row.tokenId), ["9"]);
  assert.deepEqual(filterMarket(rows, "people").map(row => row.tokenId), ["5", "6"]);
  assert.equal(filterMarket(rows, "all").length, 3);
});

test("kept lives list every owned token with its deed and reach", () => {
  const rows = keptRows([{ token_id: "9", ...token("figure", "euclid", "letters", 70) }, { token_id: "5", ...token("npc", null, "craft", 40) }]);
  assert.deepEqual(rows.map(row => [row.tokenId, row.title, row.actionName, row.href]), [
    ["9", "Euclid, the geometer", "Open a school", "#token/9"],
    ["5", "Craftworker of Alexandria", "Take an apprentice", "#token/5"],
  ]);
  assert.equal(rows[1].emblem, "craft");
});
