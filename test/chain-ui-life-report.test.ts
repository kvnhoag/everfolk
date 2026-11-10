import assert from "node:assert/strict";
import test from "node:test";
import type { LifeView, MintResult } from "../chain/types.ts";
import { formatPercent, lifeReport, lifeSpanLine, mintRevealView, npcActionMenu } from "../client/chain/life-report-model.ts";
import { formatNear } from "../client/chain/near-amount.ts";

const hash = "b".repeat(64);
const life: LifeView = {
  life_id: "4", account_id: "bob.testnet", seed: "c".repeat(64), world_version: "alexandria-ranked-1", status: "alive",
  figure_picks: [{ figure_id: "euclid", token_id: "3", action_id: "euclid.school", rarity: 2 }],
  draws: [
    { step: 9, category: "education", token_id: "5", action_id: "letters.teach", rarity: 1, commands_hash: hash },
    { step: 14, category: "war", token_id: null, action_id: null, rarity: null, commands_hash: hash },
    { step: 20, category: "money", token_id: "7", action_id: "commerce.credit", rarity: 0, commands_hash: hash },
  ],
  checkpoints: [], started_at_ms: 0,
};

test("each source shows who it was, what it did and its share", () => {
  const report = lifeReport({ life, sources: [{ token_id: "3", impact: 75_000 }, { token_id: "5", impact: 25_000 }], owners: { "3": "alice.testnet" } });
  assert.equal(report.rows.length, 2);
  const [euclid, scholar] = report.rows;
  assert.equal(euclid.tokenId, "3");
  assert.equal(euclid.who, "Euclid (alice.testnet)");
  assert.equal(euclid.kind, "figure");
  assert.equal(euclid.actionName, "Open a school");
  assert.match(euclid.actionLabel, /school/iu);
  assert.equal(euclid.rarityLabel, "Rare");
  assert.equal(euclid.percentText, "75%");
  assert.equal(scholar.who, "A scholar");
  assert.equal(scholar.kind, "npc");
  assert.equal(scholar.actionName, "Teach the young");
  assert.equal(scholar.percentText, "25%");
  assert.equal(report.unassignedPercent, null);
});

test("share percentages sum to 100 for 3 equal sources", () => {
  const report = lifeReport({ life, sources: [{ token_id: "3", impact: 5 }, { token_id: "5", impact: 5 }, { token_id: "7", impact: 5 }] });
  assert.equal(report.rows.reduce((sum, row) => sum + row.bps, 0), 10_000);
  assert.equal(Math.round(report.rows.reduce((sum, row) => sum + row.percent, 0) * 100), 10_000);
  assert.deepEqual(report.rows.map(row => row.percentText).sort(), ["33.33%", "33.33%", "33.34%"]);
});

test("uneven shares use largest remainder, like the contract", () => {
  const report = lifeReport({ life, sources: [{ token_id: "3", impact: 2 }, { token_id: "5", impact: 1 }, { token_id: "7", impact: 4 }] });
  assert.deepEqual(report.rows.map(row => [row.tokenId, row.bps]), [["7", 5714], ["3", 2857], ["5", 1429]]);
  assert.equal(report.rows.reduce((sum, row) => sum + row.bps, 0), 10_000);
});

test("a life shaped by nobody has no rows", () => {
  assert.deepEqual(lifeReport({ life, sources: [] }).rows, []);
});

test("percent text trims trailing zeros", () => {
  assert.equal(formatPercent(10_000), "100%");
  assert.equal(formatPercent(2_510), "25.1%");
  assert.equal(formatPercent(1), "0.01%");
});

test("NPC action menu holds only the life's career group", () => {
  assert.deepEqual(npcActionMenu("letters").map(option => option.id), ["letters.teach", "letters.lend-books"]);
  assert.deepEqual(npcActionMenu("sky").map(option => option.name), ["Cast a favourable omen", "Warn of a bad year"]);
  for (const option of npcActionMenu("craft")) assert.ok(option.description.length > 0);
});

test("reveal tells a figure from an NPC, with rarity and affection", () => {
  const figure: MintResult = { token_id: "12", kind: "figure", figure_id: "euclid", rarity: 2, affection: 71 };
  const view = mintRevealView(figure, "letters");
  assert.equal(view.title, "Euclid, the geometer");
  assert.equal(view.kindLabel, "Famous figure");
  assert.equal(view.rarityLabel, "Rare");
  assert.equal(view.affectionText, "Affection 71 / 100");
  assert.equal(view.href, "#token/12");

  const npc = mintRevealView({ token_id: "13", kind: "npc", figure_id: null, rarity: 0, affection: 9 }, "letters");
  assert.equal(npc.title, "Scholar of Alexandria");
  assert.equal(npc.kindLabel, "Person of the city");
  assert.equal(npc.rarityLabel, "Common");
});

test("life span line and fee text", () => {
  assert.equal(lifeSpanLine({ birth_year: -350, death_year: -289, death_age: 61 }), "350 BCE – 289 BCE · lived 61 years");
  assert.equal(formatNear((10n ** 24n).toString()), "1");
});
