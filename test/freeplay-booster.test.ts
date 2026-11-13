import assert from "node:assert/strict";
import test from "node:test";
import { createFreePlayBooster, generateFreePlayEvidence } from "../client/models/freeplay-booster.ts";
import { figureFixture } from "./helpers/figure-path-fixture.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

const mockWorld: WorldPack = {
  version: "alexandria-lives-5",
  fingerprint: "test-world-fingerprint",
  startYear: -350,
  origins: [],
  activities: [],
  events: [],
  endings: [],
  stats: {},
};

function createMockLife(seed: string, peakJob = "grain-dealer"): LifeState {
  return {
    worldFingerprint: "test-world-fingerprint",
    seed,
    year: -300,
    age: 50,
    phase: "ended",
    originId: "farmer-household",
    stats: { health: 70, wealth: 500, bonds: 65 },
    character: {
      name: "Demetrios",
      skills: { farming: 60, trading: 40 },
      jobId: peakJob,
    },
    journal: [
      { type: "birth", year: -350, text: "Born in Rhakotis" },
      { type: "activity", year: -320, id: peakJob, text: "Worked as grain dealer" },
    ],
    flags: {},
    commands: [],
    accomplishments: [{ achievementId: "granary-hero", age: 35 }],
  };
}

test("generateFreePlayEvidence creates accurate deterministic evidence without network calls", async () => {
  const life = createMockLife("seed-alpha-123", "soldier");
  const evidence = await generateFreePlayEvidence(life, mockWorld);

  assert.equal(evidence.v, 1);
  assert.equal(evidence.seed, "seed-alpha-123");
  assert.equal(evidence.career_group, "military");
  assert.equal(evidence.death_age, 50);
  assert.equal(evidence.birth_year, -350);
  assert.equal(evidence.death_year, -300);
  assert.equal(evidence.account_id, "freeplay.local");
  assert.deepEqual(evidence.sources, []);
});

test("a free life that followed no historical figure earns no pack, however long it lived", async () => {
  for (const life of [createMockLife("seed-beta-456", "tenant-farmer"), { ...createMockLife("seed-elder", "tenant-farmer"), age: 75 }]) {
    const { pack, evidence } = await createFreePlayBooster(life, mockWorld);
    assert.deepEqual(pack.cards, []);
    assert.equal(pack.total_fee, "0");
    assert.equal(evidence.career_group, "farming");
  }
});

test("a free pack holds exactly the cards the life earned on a figure path, as Weave would mint them", async () => {
  const run = figureFixture("free-pack-euclid");
  run.researchMastery();
  const path = run.path("euclid");
  run.advanceTo(50); run.yearly(path.encounter.activityId);
  run.contribute(path);
  run.completeCapstone(path);
  const life = { ...run.life, phase: "ended" as const, character: { ...run.life.character!, sex: "female" as const } };
  const { pack, evidence } = await createFreePlayBooster(life, run.world);
  assert.deepEqual(pack.cards.map(card => card.card_id), ["euclid-parent", "euclid-epic-female"]);
  assert.deepEqual(evidence.earned_cards?.map(card => card.card_id), ["euclid-parent", "euclid-epic-female"]);
  assert.equal(pack.cards[0].kind, "figure");
  assert.equal(pack.cards[0].figure_id, "euclid");
  assert.deepEqual([pack.cards[0].rarity, pack.cards[1].rarity], [4, 3]);
  assert.equal(pack.cards[1].kind, "npc", "a contributor is a person of the city, not the figure");
  const again = await createFreePlayBooster(life, run.world);
  assert.deepEqual(again.pack.cards, pack.cards, "the same life always opens the same pack");
});

test("different life seeds produce different evidence", async () => {
  const [b1, b2] = await Promise.all([
    createFreePlayBooster(createMockLife("seed-gamma-111", "copyist"), mockWorld),
    createFreePlayBooster(createMockLife("seed-delta-999", "copyist"), mockWorld),
  ]);
  assert.notEqual(b1.pack.evidence_hash, b2.pack.evidence_hash);
});

test("only finished lives open a free pack", async () => {
  const life = createMockLife("complete-life", "copyist");
  await assert.rejects(createFreePlayBooster({ ...life, phase: "ready" }, mockWorld), /Complete this life/);
});

test("freeplay contract stub has fixed pack contents and blocks NFT minting", async () => {
  const life = createMockLife("seed-fixed-pack-test", "grain-dealer");
  const { pack, contract } = await createFreePlayBooster(life, mockWorld);

  assert.equal("rerollMintSlot" in contract, false);

  // Only Weave Mode can mint cards to NFT
  await assert.rejects(async () => {
    await contract.chooseMintSlot(pack.life_id, 0);
  }, /Only Weave Mode can mint cards to NFT/);
});

test("a free life with no job is grouped by its strongest skill, not as a performer", async () => {
  const life = createMockLife("no-job");
  life.character = { ...life.character!, jobId: undefined, skills: { farming: 60, trading: 10 } } as LifeState["character"];
  life.journal = life.journal.filter(entry => entry.type !== "activity");
  const evidence = await generateFreePlayEvidence(life, mockWorld);
  assert.equal(evidence.career_group, "farming");
});
