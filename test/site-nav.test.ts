import assert from "node:assert/strict";
import test from "node:test";
import { SITE_LINKS, siteSectionForHash } from "../client/models/site-nav.ts";

test("every screen shares one header with Market visible from the start", () => {
  assert.deepEqual(SITE_LINKS.map(link => link.label), ["Play", "Weave Mode", "Market", "Figures", "My lives"]);
  assert.deepEqual(SITE_LINKS.map(link => link.href), ["#", "#weave", "#market", "/cards", "#mine"]);
});

test("the current section follows the chain route in the address", () => {
  assert.equal(siteSectionForHash(""), "play");
  assert.equal(siteSectionForHash("#life"), "play");
  assert.equal(siteSectionForHash("#weave"), "weave");
  assert.equal(siteSectionForHash("#ranked"), "weave");
  assert.equal(siteSectionForHash("#pack/12"), "weave");
  assert.equal(siteSectionForHash("#market"), "market");
  assert.equal(siteSectionForHash("#token/4"), "market");
  assert.equal(siteSectionForHash("#figures"), "figures");
  assert.equal(siteSectionForHash("#mine"), "mine");
});
