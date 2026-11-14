import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/engine.ts";
import { buildContributionTierWorld } from "../src/figures/contribution-world.ts";
import { buildCommonContributionWorld } from "../src/figures/common-contribution-world.ts";
import { LIVES_WORLD_VERSION } from "../src/vocations/ids.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import type { WorldPack } from "../src/types.ts";
import retainedLives from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import retainedFigures from "../worlds/demo/alexandria-figures-1.json" with { type: "json" };
import currentLives from "../worlds/demo/alexandria-lives-7-wsl-contributions.json" with { type: "json" };
import currentFigures from "../worlds/demo/alexandria-figures-2.json" with { type: "json" };

import commonLives from "../worlds/demo/alexandria-lives-8-wsl-contributions.json" with { type: "json" };
import commonFigures from "../worlds/demo/alexandria-figures-3.json" with { type: "json" };

const pairs = [[retainedLives, currentLives], [retainedFigures, currentFigures]] as const;

test("both new contribution releases reproduce exactly without changing their retained base", () => {
  for (const [base, shipped] of pairs) {
    const before = JSON.stringify(base);
    const built = buildContributionTierWorld(base as unknown as WorldPack);
    assert.deepEqual(built, shipped);
    assert.equal(JSON.stringify(base), before);
    const engine = createEngine(built);
    assert.equal(engine.world.figurePaths!.length, 11);
    for (const path of built.figurePaths!) {
      assert.deepEqual(path.stages.map(stage => stage.rank), path.baseRank === "Epic" ? ["Common", "Uncommon", "Rare"] : ["Uncommon", "Rare", "Epic"]);
      assert.equal(Boolean(path.legendaryContribution), Boolean(path.promotion));
    }
  }
});

test("new births load the balanced successor while retained figure revisions keep their own rules", async () => {
  assert.equal(LIVES_WORLD_VERSION, "alexandria-lives-11", "lives-10 born across 400–300 BCE (test/history-household-world.test.ts)");
  for (const pack of [retainedLives, currentLives, commonLives, retainedFigures, currentFigures, commonFigures]) {
    const loaded = engineForLife(createEngine(pack as unknown as WorldPack).start("retained-contribution-world")).world;
    assert.equal(loaded.version, pack.version);
    assert.deepEqual(loaded.figurePaths, pack.figurePaths);
  }
  const oldPath = retainedLives.figurePaths.find(path => path.id === "pytheas")!;
  assert.deepEqual(oldPath.stages.map(stage => stage.rank), ["Uncommon", "Rare", "Epic"]);
});

test("saved lives resolve the exact registered world and replay under that world", () => {
  for (const pack of [retainedLives, currentLives, commonLives, retainedFigures, currentFigures, commonFigures]) {
    const engine = createEngine(pack as unknown as WorldPack);
    const life = engine.start("contribution-world-registration");
    const registered = engineForLife(life);
    assert.equal(registered.world.version, pack.version);
    assert.equal(registered.fingerprint, engine.fingerprint);
    assert.deepEqual(loadAnyLife(engine.save(life)), life);
  }
});

test("the retained shipped figure packs remain byte-for-byte unchanged", () => {
  const digest = (name: string) => createHash("sha256").update(readFileSync(new URL(`../worlds/demo/${name}.json`, import.meta.url))).digest("hex");
  assert.equal(digest("alexandria-lives-7-wsl-contributions"), "7fba2d4fe43d7399d85a8a713feb5dc296d6937ca5cf73aeddd519ffb9eacb86");
  assert.equal(digest("alexandria-figures-2"), "4ee0a2c2a8233fd86af04dfe16de355b32f5fe42c6fb1c036366717c9b6c3fc5");
  assert.equal(digest("alexandria-lives-6"), "13ab85a77ec1d17ac7b890ea687b59e354a361ccefcdf29f3ca6348f13c260a2");
  assert.equal(digest("alexandria-figures-1"), "dbde7e85a21167126dd20275635b5f5693e3f7c65bb0ee053482b5660a26874e");
});


test("Common-entry releases reproduce their shipped worlds from the retained contribution packs", () => {
  for (const [base, shipped] of [[currentLives, commonLives], [currentFigures, commonFigures]] as const) {
    const before = JSON.stringify(base);
    assert.deepEqual(buildCommonContributionWorld(base as unknown as WorldPack), shipped);
    assert.equal(JSON.stringify(base), before);
  }
});
