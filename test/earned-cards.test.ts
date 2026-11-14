import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { earnedCards, reachableEarnedCardIds } from "../chain/earned-cards.ts";
import { figureFixture } from "./helpers/figure-path-fixture.ts";
import lives11 from "../worlds/demo/alexandria-lives-11.json" with { type: "json" };

const withSex = (life: LifeState, sex: "male" | "female" | undefined): LifeState =>
  ({ ...life, character: { ...life.character!, sex } as LifeState["character"] });

test("a life that followed no historical figure earns no card", () => {
  const world = lives11 as unknown as WorldPack;
  const life = createEngine(world).start("ordinary-citizen");
  assert.deepEqual(earnedCards(world, life), []);
});

test("an earned contribution is that figure's profession card at the earned rank, in the player's sex; the capstone adds the figure", () => {
  const run = figureFixture("aristotle-earned-cards");
  run.researchFoundation();
  const path = run.path("aristotle");
  run.advanceTo(18); run.yearly(path.encounter.activityId);
  run.researchMastery();
  run.contribute(path);
  assert.deepEqual(earnedCards(run.world, withSex(run.life, "female")), [
    { card_id: "aristotle-epic-female", figure_id: "aristotle", kind: "contribution", rarity: 3 },
  ], "contribution only: Disciple status is not the figure-defining capstone");
  run.completeCapstone(path);
  assert.deepEqual(earnedCards(run.world, withSex(run.life, "male")), [
    { card_id: "aristotle-parent", figure_id: "aristotle", kind: "principal", rarity: 4 },
    { card_id: "aristotle-epic-male", figure_id: "aristotle", kind: "contribution", rarity: 3 },
  ]);
  assert.deepEqual(earnedCards(run.world, withSex(run.life, undefined)), [
    { card_id: "aristotle-parent", figure_id: "aristotle", kind: "principal", rarity: 4 },
  ], "an unrecorded sex never guesses a profession card; the figure card needs none");
});

test("an Epic figure stays Epic after its capstone, and its contributors stop at Rare", () => {
  const run = figureFixture("theophrastus-earned-cards");
  run.researchFoundation(); run.advanceTo(18);
  const path = run.path("theophrastus");
  run.yearly(path.encounter.activityId);
  run.researchMastery();
  run.contribute(path);
  run.completeCapstone(path);
  assert.deepEqual(earnedCards(run.world, withSex(run.life, "female")), [
    { card_id: "theophrastus-parent", figure_id: "theophrastus", kind: "principal", rarity: 3 },
    { card_id: "theophrastus-rare-female", figure_id: "theophrastus", kind: "contribution", rarity: 2 },
  ]);
});

test("every card a life can earn in the Weave world has approved v14 art", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/assets/cards/collection-v14/manifest.json", import.meta.url), "utf8"));
  const known = new Set([...manifest.assets, ...manifest.parentVariants].map((card: { id: string }) => card.id));
  const reachable = reachableEarnedCardIds(lives11 as unknown as WorldPack);
  assert.ok(reachable.length >= 11 + 3 + 2 * (5 * 4 + 6 * 3 + 3));
  for (const id of reachable) assert.ok(known.has(id), id);
  assert.ok(reachable.includes("ptolemy-parent-legendary"), "a promoted Epic figure has its Legendary card");
  assert.ok(reachable.includes("zeno-epic-male"), "a promoted figure's recognition is an Epic contribution");
  assert.ok(!reachable.includes("cleomenes-epic-male"), "an Epic figure's contributors stop at Rare");
  assert.ok(!reachable.some(id => /-legendary-(male|female)$/.test(id)), "no contributor is ever Legendary");
});
