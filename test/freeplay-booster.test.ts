import assert from "node:assert/strict";
import test from "node:test";
import { createFreePlayBooster, generateFreePlayEvidence } from "../client/models/freeplay-booster.ts";
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

test("createFreePlayBooster scales 1-5 cards by duration & titles, and 0 cards before adulthood", async () => {
  const earlyDeathLife = {
    ...createMockLife("seed-early", "tenant-farmer"),
    age: 16,
    accomplishments: [{ achievementId: "first-day", age: 10 }],
  };
  const early = await createFreePlayBooster(earlyDeathLife, mockWorld);
  assert.equal(early.pack.cards.length, 0);

  const youngAdultLife = {
    ...createMockLife("seed-young", "tenant-farmer"),
    age: 22,
    accomplishments: [],
  };
  const young = await createFreePlayBooster(youngAdultLife, mockWorld);
  assert.equal(young.pack.cards.length, 1);

  const life = createMockLife("seed-beta-456", "tenant-farmer");
  const { pack, evidence } = await createFreePlayBooster(life, mockWorld);

  // age 50 (base 2) + 1 accomplishment + matched figures >= 3, capped at 5
  assert.ok(pack.cards.length >= 3 && pack.cards.length <= 5);
  assert.equal(pack.total_fee, "0");
  assert.equal(evidence.career_group, "farming");

  for (const card of pack.cards) {
    assert.ok(card.rarity >= 0 && card.rarity <= 4);
    assert.ok(card.affection >= 1 && card.affection <= 100);
    assert.ok(card.kind === "figure" || card.kind === "npc");
    assert.ok(typeof card.action_id === "string");
  }

  // Idempotency: generating from the same life reproduces the exact same cards
  const second = await createFreePlayBooster(life, mockWorld);
  assert.deepEqual(pack.cards, second.pack.cards);
  assert.equal(pack.evidence_hash, second.pack.evidence_hash);

  const elderHighTitleLife = {
    ...createMockLife("seed-elder", "tenant-farmer"),
    age: 75,
    accomplishments: [
      { achievementId: "a", age: 20 },
      { achievementId: "b", age: 35 },
      { achievementId: "c", age: 50 },
    ],
  };
  const elder = await createFreePlayBooster(elderHighTitleLife, mockWorld);
  assert.equal(elder.pack.cards.length, 5);
});

test("different life seeds produce different booster card rolls", async () => {
  const life1 = createMockLife("seed-gamma-111", "copyist");
  const life2 = createMockLife("seed-delta-999", "copyist");

  const [b1, b2] = await Promise.all([
    createFreePlayBooster(life1, mockWorld),
    createFreePlayBooster(life2, mockWorld),
  ]);

  assert.notEqual(b1.pack.evidence_hash, b2.pack.evidence_hash);
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

test("a free pack's people-of-the-city cards do not all repeat the same action", async () => {
  for (const seed of ["vary-a", "vary-b", "vary-c", "vary-d"]) {
    const { pack } = await createFreePlayBooster(createMockLife(seed), mockWorld);
    const npcActions = pack.cards.filter(card => card.kind === "npc").map(card => card.action_id);
    if (npcActions.length > 1) assert.ok(new Set(npcActions).size > 1, `${seed}: ${npcActions.join(", ")}`);
  }
});

test("a free life with no job is grouped by its strongest skill, not as a performer", async () => {
  const life = createMockLife("no-job");
  life.character = { ...life.character!, jobId: undefined, skills: { farming: 60, trading: 10 } } as LifeState["character"];
  life.journal = life.journal.filter(entry => entry.type !== "activity");
  const evidence = await generateFreePlayEvidence(life, mockWorld);
  assert.equal(evidence.career_group, "farming");
});
