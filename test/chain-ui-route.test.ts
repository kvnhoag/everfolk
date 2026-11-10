import assert from "node:assert/strict";
import test from "node:test";
import { chainHref, parseChainRoute } from "../client/chain/chain-route.ts";

test("hash routes for the ranked screens", () => {
  assert.deepEqual(parseChainRoute("#ranked"), { kind: "ranked" });
  assert.deepEqual(parseChainRoute("#market"), { kind: "market" });
  assert.deepEqual(parseChainRoute("#token/12"), { kind: "token", tokenId: "12" });
  assert.deepEqual(parseChainRoute("#token/0"), { kind: "token", tokenId: "0" });
});

test("anything else leaves the game alone", () => {
  for (const hash of ["", "#", "#token/", "#token/abc", "#token/1/2", "#market/1", "#about", "#token/01x"]) {
    assert.equal(parseChainRoute(hash), null, hash);
  }
});

test("links round-trip", () => {
  assert.equal(chainHref({ kind: "token", tokenId: "7" }), "#token/7");
  assert.equal(chainHref({ kind: "market" }), "#market");
  assert.deepEqual(parseChainRoute(chainHref({ kind: "token", tokenId: "7" })), { kind: "token", tokenId: "7" });
});
