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

test("createFreePlayBooster generates exactly 3 cards seeded from the life seed", async () => {
  const life = createMockLife("seed-beta-456", "tenant-farmer");
  const { pack, evidence, contract } = await createFreePlayBooster(life, mockWorld);

  assert.equal(pack.cards.length, 3);
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

test("freeplay contract stub allows slot reroll and selection without on-chain execution", async () => {
  const life = createMockLife("seed-reroll-test", "grain-dealer");
  const { pack, contract } = await createFreePlayBooster(life, mockWorld);

  // Reroll slot 1
  const updatedPack = await contract.rerollMintSlot(pack.life_id, 1, "0");
  assert.ok(updatedPack.cards[1].rerolled);
  assert.equal(updatedPack.cards[0].rerolled, false);

  // Second reroll on slot 1 should throw
  await assert.rejects(async () => {
    await contract.rerollMintSlot(pack.life_id, 1, "0");
  }, /already rerolled/);

  // Choose slot 0
  const chosen = await contract.chooseMintSlot(pack.life_id, 0);
  assert.equal(chosen.kind, pack.cards[0].kind);
  assert.equal(chosen.rarity, pack.cards[0].rarity);
});
