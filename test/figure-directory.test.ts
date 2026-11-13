import test from "node:test";
import assert from "node:assert/strict";
import { loadFigureOwnership, matchingFigures } from "../client/chain/figure-directory-model.ts";
import { FIGURE_IDS } from "../chain/ids.ts";
import type { LivesContract } from "../client/chain/types.ts";

test("the directory includes eleven searchable figures and only legal variants", () => {
  assert.equal(matchingFigures("").length, 11);
  assert.deepEqual(matchingFigures("  BRONZE ").map(figure => figure.id), ["lysippos"]);
  assert.deepEqual(matchingFigures("ptolemy", "Legendary").map(figure => figure.id), ["ptolemy"]);
  assert.equal(matchingFigures("pytheas", "Legendary").length, 0);
  assert.equal(matchingFigures("menander", "Epic").length, 0);
  assert.equal(matchingFigures("missing figure").length, 0);
});

test("ownership reads use only the four deployed contract identities", async () => {
  const copies: string[] = [], supply: string[] = [];
  const result = await loadFigureOwnership({
    async figureCopies(id) { copies.push(id); return []; },
    async figureSupply(id) { supply.push(id); return [0, 100]; },
    async token() { throw new Error("Empty pools must not read a token"); },
  });
  assert.deepEqual(copies.sort(), [...FIGURE_IDS].sort());
  assert.deepEqual(supply.sort(), [...FIGURE_IDS].sort());
  assert.equal(Object.keys(result).length, 4);
  assert.equal("lysippos" in result, false);
});

test("a missing copy reports an unavailable ownership record instead of inventing it", async () => {
  await assert.rejects(loadFigureOwnership({
    async figureCopies(id) { return id === "alexander" ? [{ token_id: "7" }] as Awaited<ReturnType<LivesContract["figureCopies"]>> : []; },
    async figureSupply() { return [1, 100]; },
    async token() { return null; },
  }), /figure copy could not be read/);
});
