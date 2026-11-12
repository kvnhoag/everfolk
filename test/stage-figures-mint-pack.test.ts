import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidence } from "../chain/evidence.ts";
import { sha256Hex } from "../chain/hash.ts";
import type { StageRecord } from "../chain/stage-figures.ts";
import {
  TESTNET_STAGE_FIGURE_GENERIC_FEE_YOCTO,
  TESTNET_STAGE_FIGURE_HISTORICAL_FEE_YOCTO,
} from "../chain/stage-figures.ts";
import type { LifeView, SaveFile } from "../chain/types.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { formatNear } from "../client/chain/near-amount.ts";
import type { LifeState } from "../src/types.ts";

function sampleStageRecords(): StageRecord[] {
  return [
    {
      stageId: "infancy",
      title: "Infant of the Nile",
      fromAge: 0,
      toAge: 2,
      district: "delta",
      field: "farming",
      tier: 1,
      jobId: "none",
      topSkills: { farming: 5 },
      nodes: ["farming.seed"],
      reputation: 0,
      accomplishments: [],
      mentors: [],
    },
    {
      stageId: "childhood",
      title: "Child of Rhakotis",
      fromAge: 6,
      toAge: 11,
      district: "rhakotis",
      field: "craft",
      tier: 2,
      jobId: "apprentice-weaver",
      topSkills: { craft: 25, literacy: 15 },
      nodes: ["craft.loom", "literacy.letters"],
      reputation: 10,
      accomplishments: ["first-cloth"],
      mentors: ["Theodotos"],
    },
    {
      stageId: "youth",
      title: "Cavalry Cadet",
      fromAge: 14,
      toAge: 15,
      district: "royal-quarter",
      field: "military",
      tier: 3,
      jobId: "soldier",
      topSkills: { warfare: 70 },
      nodes: ["military.cavalry"],
      reputation: 35,
      accomplishments: ["convoy-distinction"],
      mentors: ["General Parmenion"],
    },
  ];
}

function mockLife(seed = "test-seed-42"): LifeView {
  return {
    life_id: "1",
    account_id: "alice.testnet",
    seed,
    world_version: "alexandria-demo-2",
    status: "alive",
    figure_picks: [],
    draws: [],
    checkpoints: [],
    started_at_ms: 1000,
  };
}

function mockSave(seed = "test-seed-42"): SaveFile {
  return {
    schemaVersion: 1,
    worldId: "alexandria-demo",
    worldVersion: "alexandria-demo-2",
    worldFingerprint: "fingerprint-demo-2",
    seed,
    commands: [],
    createdMs: 1000,
    savedMs: 2000,
  };
}

function mockState(stageRecords?: StageRecord[]): LifeState {
  return {
    schemaVersion: 1,
    worldId: "alexandria-demo",
    worldVersion: "alexandria-demo-2",
    worldFingerprint: "fingerprint-demo-2",
    seed: "test-seed-42",
    rngState: 1234,
    age: 25,
    year: -330,
    originId: "court-household",
    stats: { health: 70, wealth: 60, knowledge: 50, bonds: 55 },
    flags: {},
    phase: "ended",
    pendingEventId: null,
    endingId: "natural",
    eventCounts: {},
    lastEventAge: {},
    character: {
      name: "Kallias",
      sex: "male",
      skills: { warfare: 70, literacy: 30 },
      jobId: "soldier",
      partnerId: null,
      relationshipStatus: "single",
      children: [],
      lastActivityAge: null,
      lastActivityAges: {},
    },
    accomplishments: [{ id: "convoy-distinction:15", achievementId: "convoy-distinction", age: 15 }],
    stageRecords,
    journal: [
      { type: "birth", id: "court-household", text: "Born in the court", age: 0, year: -355 },
      { type: "ending", id: "natural", text: "Lived well", age: 25, year: -330 },
    ],
    commands: [],
  } as unknown as LifeState;
}

test("buildEvidence incorporates stage records and matched stage figures when present", async () => {
  const records = sampleStageRecords();
  const state = mockState(records);
  const life = mockLife();
  const save = mockSave();

  const evidence = await buildEvidence({ life, save, state, worldFingerprint: "fingerprint-demo-2" });

  assert.ok(evidence.stage_records, "stage_records should be present");
  assert.equal(evidence.stage_records?.length, 3);
  assert.ok(evidence.stage_figures, "stage_figures should be present");
  assert.equal(evidence.stage_figures?.length, 3);

  // Infancy stage: generic stage portrait
  const infancy = evidence.stage_figures![0];
  assert.equal(infancy.stageId, "infancy");
  assert.equal(infancy.kind, "generic");
  assert.equal(infancy.name, "Kallias");
  assert.ok(infancy.media.includes("/assets/pixel/portraits/infant-"));

  // Childhood stage: generic stage portrait
  const childhood = evidence.stage_figures![1];
  assert.equal(childhood.stageId, "childhood");
  assert.equal(childhood.kind, "generic");
  assert.equal(childhood.name, "Kallias");
  assert.ok(childhood.media.includes("/assets/pixel/portraits/child-"));

  // Youth stage meets Alexander's requirements (court origin, soldier, warfare >= 60, convoy distinction at age 15 <= 32)
  const youth = evidence.stage_figures![2];
  assert.equal(youth.stageId, "youth");
  assert.equal(youth.kind, "historical");
  assert.equal(youth.figureId, "alexander");
  assert.equal(youth.name, "Alexander the Great");
  assert.equal(youth.media, "/assets/figures/alexander.png");
});

test("buildEvidence omits stage_records and stage_figures when state has no stage records", async () => {
  const state = mockState(undefined);
  const life = mockLife();
  const save = mockSave();

  const evidence = await buildEvidence({ life, save, state, worldFingerprint: "fingerprint-demo-2" });

  assert.equal(evidence.stage_records, undefined);
  assert.equal(evidence.stage_figures, undefined);
});

test("testnet stage figure fees are divided by 10", () => {
  assert.equal(formatNear(TESTNET_STAGE_FIGURE_GENERIC_FEE_YOCTO), "0.002");
  assert.equal(formatNear(TESTNET_STAGE_FIGURE_HISTORICAL_FEE_YOCTO), "0.01");
});

test("mock contract pack cards and minting support stage figures", async () => {
  const contract = createMockContract({ accountId: "alice.testnet" });
  const life = await contract.startLife("alexandria-demo-2");
  const records = sampleStageRecords();
  const state = mockState(records);
  state.seed = life.seed;
  const save = mockSave(life.seed);
  save.commands = [...life.figure_picks.map((pick, i) => ({ type: "influence", mode: "activate", entry: pick.action_id, power: 1, source: { contractId: "contract", tokenId: pick.token_id } }))];
  state.commands = save.commands as any;

  const evidence = await buildEvidence({ life, save, state, worldFingerprint: "fingerprint-demo-2" });

  const signed = {
    evidence,
    evidence_json: JSON.stringify(evidence),
    evidence_hash: await sha256Hex(JSON.stringify(evidence)),
    signature: "0".repeat(128),
    verifier_kind: "server-signer" as const,
  };

  const pack = await contract.openMintPack(life.life_id, signed, "military.guard-road");
  assert.ok(pack.cards.length >= 3);

  // Check that pack cards carry stage figures when stage figures are present in evidence
  const hasStageCard = pack.cards.some(c => c.stage_id !== undefined);
  assert.ok(hasStageCard, "Pack cards should contain stage figures from evidence");

  // Choose a card with stage info to mint
  const stageSlot = pack.cards.findIndex(c => c.stage_id !== undefined);
  const chosenSlot = stageSlot >= 0 ? stageSlot : 0;
  const result = await contract.chooseMintSlot(life.life_id, chosenSlot);

  assert.ok(result.token_id);
  const token = await contract.token(result.token_id);
  assert.ok(token);

  if (pack.cards[chosenSlot].stage_id) {
    assert.equal(token?.extra.stage_id, pack.cards[chosenSlot].stage_id);
    assert.equal(token?.extra.character_name, "Kallias");
    assert.ok(token?.extra.portrait_media);
  }
});
