import assert from "node:assert/strict";
import test from "node:test";
import { editionLabel, nextEditionLabel } from "../client/chain/edition-label.ts";
import { mintRevealView } from "../client/chain/life-report-model.ts";
import { keptRows, marketRows, tokenPageView } from "../client/chain/token-page-model.ts";
import type { TokenView } from "../client/chain/types.ts";

test("edition labels use confirmed serials and preserve unlimited sequential copies", () => {
  assert.equal(editionLabel({ edition_number: 1, edition_limit: 10 }), "001/010");
  assert.equal(editionLabel({ edition_number: 25, edition_limit: 25 }), "025/025");
  assert.equal(editionLabel({ edition_number: 1001, edition_limit: null }), "1001 · Unlimited");
  assert.equal(editionLabel({ edition_number: 11, edition_limit: 10 }), "011/010", "older over-cap copies retain their actual serial");
  for (const value of [{}, { edition_number: 1 }, { edition_number: 0, edition_limit: 10 }, { edition_number: 1, edition_limit: 0 }]) {
    assert.equal(editionLabel(value), null);
  }
});

test("preview is current minted plus one from the response, and finite sold-out series have no next serial", () => {
  assert.equal(nextEditionLabel({ next_edition_number: 7, edition_limit: 25 }), "Next edition 007/025");
  assert.equal(nextEditionLabel({ next_edition_number: null, edition_limit: 10 }), "Edition sold out");
  assert.equal(nextEditionLabel({ next_edition_number: 101, edition_limit: null }), "Next edition 101 · Unlimited");
  assert.equal(nextEditionLabel({}), null);
});

const token: TokenView & { token_id: string } = {
  token_id: "900", owner_id: "alice.testnet",
  extra: { kind: "figure", figure_id: "euclid", rarity: 4, affection: 60, action_id: "euclid.school", life_id: "80",
    birth_year: -350, death_year: -289, career_group: "letters", sources: [], evidence_hash: "a".repeat(64),
    edition_key: "figure:euclid:rarity:4", edition_number: 3, edition_limit: 10 },
};

test("mint reveal and retrieved token views retain the edition separately from the global token id", () => {
  const reveal = mintRevealView({ token_id: token.token_id, ...token.extra }, "letters");
  assert.equal(reveal.number, "Edition 003/010");
  assert.equal(reveal.rows.find(row => row.label === "Edition")?.value, "003/010");
  const view = tokenPageView({ tokenId: token.token_id, token, stats: { lives_influenced: 0, earned: "0" }, viewer: null, balance: "0", listing: null, children: [], sourceTokens: {} });
  assert.equal(view.editionText, "003/010");
  assert.equal(keptRows([token])[0].editionText, "003/010");
  assert.equal(marketRows([{ token_id: token.token_id, seller_id: token.owner_id, price: "1" }], { [token.token_id]: token }, null)[0].editionText, "003/010");
});

test("older tokens without edition facts never use their global id as a copy number", () => {
  const { edition_key: _key, edition_number: _number, edition_limit: _limit, ...legacy } = token.extra;
  const view = mintRevealView({ token_id: "900", ...legacy });
  assert.equal(view.number, "No. 900");
  assert.ok(!view.rows.some(row => row.label === "Edition"));
});
