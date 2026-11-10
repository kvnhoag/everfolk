import assert from "node:assert/strict";
import test from "node:test";
import type { Draw, FigurePick } from "../chain/types.ts";
import { bornIntoLines, drawBeatView, parseRankedConfig, rankedEntryView } from "../client/chain/born-into-model.ts";

const euclid: FigurePick = { figure_id: "euclid", token_id: "3", action_id: "euclid.school", rarity: 2 };
const alexander: FigurePick = { figure_id: "alexander", token_id: "1", action_id: "alexander.levy", rarity: 3 };
const hash = "a".repeat(64);

test("figure picks become plain lines naming the figure, its owner and its deed", () => {
  assert.deepEqual(bornIntoLines([euclid], { "3": "alice.testnet" }), ["Euclid (alice.testnet) has opened a school."]);
  assert.deepEqual(bornIntoLines([alexander, euclid], { "1": "bob.testnet", "3": "alice.testnet" }), [
    "Alexander (bob.testnet) has called a levy on the city.",
    "Euclid (alice.testnet) has opened a school.",
  ]);
});

test("a figure whose owner is unknown is still named", () => {
  assert.deepEqual(bornIntoLines([euclid], {}), ["Euclid has opened a school."]);
});

test("an empty world says so", () => {
  assert.deepEqual(bornIntoLines([], {}), ["No famous figures shape this world yet."]);
});

test("every figure action has a birth line", () => {
  const actions = ["alexander.found", "aristotle.lyceum", "aristotle.tutor-court", "euclid.museum", "cleomenes.corner-grain", "cleomenes.granaries"];
  for (const action_id of actions) {
    const [line] = bornIntoLines([{ ...euclid, action_id }], {});
    assert.match(line, /^Euclid \S.*\.$/u, action_id);
  }
});

test("draw beat while waiting, after an empty draw and after a draw", () => {
  const waiting = drawBeatView(null, true);
  assert.equal(waiting.status, "waiting");
  assert.equal(waiting.title, "Someone in the city noticed your choice…");

  const empty: Draw = { step: 7, category: "education", token_id: null, action_id: null, rarity: null, commands_hash: hash };
  const nobody = drawBeatView(empty, false);
  assert.equal(nobody.status, "nobody");
  assert.equal(nobody.title, "No one stepped in this time.");

  const drawn: Draw = { step: 7, category: "education", token_id: "5", action_id: "letters.teach", rarity: 1, commands_hash: hash };
  const view = drawBeatView(drawn, false, "alice.testnet");
  assert.equal(view.status, "drawn");
  assert.equal(view.who, "A scholar (alice.testnet)");
  assert.equal(view.actionName, "Teach the young");
  assert.match(view.detail, /drilled your letters/u);
  assert.equal(view.rarityLabel, "Uncommon");
  assert.equal(view.tokenId, "5");
});

test("ranked config is read defensively", () => {
  const ok = { contract_id: "everfolk-lives.testnet", rpc_url: "https://rpc.testnet.near.org", world_version: "alexandria-ranked-1", verifier_public_key: "ed25519:abc" };
  assert.deepEqual(parseRankedConfig(ok), ok);
  assert.equal(parseRankedConfig(null), null);
  assert.equal(parseRankedConfig({ ...ok, contract_id: 7 }), null);
  assert.equal(parseRankedConfig({ ...ok, rpc_url: "ftp://x" }), null);
  assert.equal(parseRankedConfig({ ...ok, contract_id: "Not An Account" }), null);
});

test("ranked menu entry is disabled with a reason unless the service answered", () => {
  assert.deepEqual(rankedEntryView("available"), { disabled: false, note: "A life recorded for keeps. Real players can shape it, and you can keep it." });
  assert.equal(rankedEntryView("checking").disabled, true);
  const closed = rankedEntryView("unavailable");
  assert.equal(closed.disabled, true);
  assert.match(closed.note, /unavailable/u);
});
