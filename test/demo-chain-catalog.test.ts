import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_DEED_INFLUENCES, GRANARY_GRAIN, SEED_BONUS_BPS, ensureDemoDeeds } from "../chain/catalog/demo-deeds.ts";
import { ARMY_SUPPLY_CONTRACT, CLEOMENES_MIN_REPUTATION, figuresForWorld } from "../chain/catalog/demo-figures.ts";
import { DEMO_KEY_DECISIONS } from "../chain/catalog/demo-key-decisions.ts";
import { FIGURES, KEY_DECISIONS, keyDecisionCategory } from "../chain/catalog/index.ts";
import { DEMO_WORLD_VERSION, RANKED_WORLD_VERSION } from "../chain/ids.ts";
import { careerGroupOf, matchFigures } from "../chain/match.ts";
import { stepCommand } from "../chain/ranked-rules.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { canonicalJson } from "../src/random.ts";
import { sha256Hex } from "../chain/hash.ts";
import { createEngine } from "../src/index.ts";
import { DEMO_WORLD_VERSION as PACK_VERSION, CONVOY_DISTINCTION } from "../src/demo/types.ts";
import type { AccomplishmentRecord, Evidence, LifeState, WorldPack } from "../src/types.ts";
import type { SignedEvidence } from "../client/chain/types.ts";
import demoWorld from "../worlds/demo/alexandria-demo-1.json" with { type: "json" };
import rankedWorld from "../worlds/ranked/alexandria-ranked-1.json" with { type: "json" };

const HASH = "ab".repeat(32);

function ended(input: Partial<LifeState> & { worldVersion: string; jobs?: string[]; accomplishments?: { achievementId: string; age: number }[] }): LifeState {
  const jobs = input.jobs ?? [];
  return {
    schemaVersion: 1,
    worldId: "alexandria",
    worldVersion: input.worldVersion,
    worldFingerprint: "fnv1a64-test",
    seed: "ab12",
    rngState: 1,
    age: 50,
    year: -300,
    originId: input.originId ?? "artisan-household",
    stats: { health: 40, wealth: 30, knowledge: 40, bonds: 40, ...(input.stats ?? {}) },
    flags: {},
    phase: "ended",
    pendingEventId: null,
    endingId: "old-age",
    eventCounts: {},
    lastEventAge: {},
    character: {
      skills: { literacy: 10, reckoning: 10, warfare: 0, oratory: 0, ...(input.character?.skills ?? {}) },
      jobId: jobs.at(-1) ?? null,
      partnerId: null,
      relationshipStatus: "single",
      children: [],
      lastActivityAge: null,
      lastActivityAges: {},
    },
    accomplishments: (input.accomplishments ?? []).map(record => ({ id: record.achievementId, achievementId: record.achievementId, age: record.age }) as AccomplishmentRecord),
    journal: [
      { type: "birth", id: input.originId ?? "artisan-household", text: "born", age: 0, year: -350 },
      ...jobs.map((job, index) => ({ type: "activity" as const, id: job, text: job, age: 20 + index, year: -330 + index })),
    ],
    commands: [],
    ...(input.demo ? { demo: input.demo } : {}),
  };
}

test("demo world version matches the shared contract", () => {
  assert.equal(DEMO_WORLD_VERSION, PACK_VERSION);
  assert.equal(DEMO_WORLD_VERSION, "alexandria-demo-1");
});

test("ranked lives never draw a new deed category", () => {
  for (const category of Object.values(KEY_DECISIONS)) {
    assert.notEqual(category, "harvest");
    assert.notEqual(category, "road");
  }
  assert.equal(keyDecisionCategory("demo-flood-failure", "ranked-1"), null);
  assert.equal(keyDecisionCategory("an-unreliable-season", "ranked-1"), "money");
  assert.equal(keyDecisionCategory("demo-flood-failure", DEMO_WORLD_VERSION), "harvest");
  assert.equal(keyDecisionCategory("demo-levy", DEMO_WORLD_VERSION), "war");
  assert.equal(keyDecisionCategory("demo-convoy-road", DEMO_WORLD_VERSION), "road");
  assert.deepEqual(DEMO_KEY_DECISIONS, {
    "demo-flood-failure": "harvest",
    "demo-levy": "war",
    "demo-convoy-road": "road",
  });
  for (const id of Object.keys(DEMO_KEY_DECISIONS)) assert.equal(Object.hasOwn(KEY_DECISIONS, id), false);
});

test("ranked figure standards are unchanged", () => {
  assert.equal(figuresForWorld(RANKED_WORLD_VERSION), FIGURES);
  const alexander = ended({
    worldVersion: "ranked-1",
    originId: "artisan-household",
    jobs: ["soldier"],
    character: { skills: { warfare: 80, oratory: 80 } },
    accomplishments: [{ achievementId: CONVOY_DISTINCTION, age: 30 }],
  });
  assert.deepEqual(matchFigures(alexander), []);
  const royal = ended({
    worldVersion: "ranked-1",
    originId: "royal-household",
    jobs: ["general"],
    stats: { wealth: 30 },
    character: { skills: { warfare: 70, oratory: 50 } },
    accomplishments: [{ achievementId: "military-first-work", age: 32 }],
  });
  assert.deepEqual(matchFigures(royal), ["alexander"]);
});

test("demo standards: Alexander by convoy distinction, Cleomenes by the grain business", () => {
  const soldier = ended({
    worldVersion: DEMO_WORLD_VERSION,
    jobs: ["soldier"],
    character: { skills: { warfare: 70 } },
    accomplishments: [{ achievementId: CONVOY_DISTINCTION, age: 32 }],
  });
  assert.deepEqual(matchFigures(soldier), ["alexander"]);
  const late = ended({
    worldVersion: DEMO_WORLD_VERSION,
    jobs: ["soldier"],
    character: { skills: { warfare: 70 } },
    accomplishments: [{ achievementId: CONVOY_DISTINCTION, age: 33 }],
  });
  assert.deepEqual(matchFigures(late), []);
  const general = ended({
    worldVersion: DEMO_WORLD_VERSION,
    jobs: ["general"],
    character: { skills: { warfare: 90, oratory: 80 } },
    accomplishments: [{ achievementId: "military-prestige", age: 28 }],
  });
  assert.deepEqual(matchFigures(general), [], "a general without convoy distinction is not the demo Alexander");

  const dealer = ended({
    worldVersion: DEMO_WORLD_VERSION,
    jobs: ["grain-dealer"],
    stats: { wealth: 90 },
    character: { skills: { reckoning: 80 } },
    accomplishments: [{ achievementId: ARMY_SUPPLY_CONTRACT, age: 40 }],
    demo: { reputation: CLEOMENES_MIN_REPUTATION } as LifeState["demo"],
  });
  assert.deepEqual(matchFigures(dealer), ["cleomenes"]);
  const shy = ended({
    worldVersion: DEMO_WORLD_VERSION,
    jobs: ["grain-dealer"],
    stats: { wealth: 90 },
    character: { skills: { reckoning: 80 } },
    accomplishments: [{ achievementId: ARMY_SUPPLY_CONTRACT, age: 40 }],
    demo: { reputation: CLEOMENES_MIN_REPUTATION - 1 } as LifeState["demo"],
  });
  assert.deepEqual(matchFigures(shy), []);
  assert.equal(careerGroupOf(dealer), "farming");
});

test("a granary deed puts grain in the store and a seed deed raises the next harvest", () => {
  const world = ensureDemoDeeds(demoWorld as unknown as WorldPack);
  assert.ok(world.influences?.some(entry => entry.id === "farming.stock-granary"));
  assert.equal((rankedWorld as { influences?: { id: string }[] }).influences?.some(entry => entry.id === "farming.stock-granary"), false);
  const engine = createEngine(world);
  const started = engine.start("demo-deed");
  const before = started.demo?.household.grain ?? 0;
  const granary = engine.influence(started, {
    type: "influence", mode: "apply", entry: "farming.stock-granary", power: 1,
    source: { contractId: "preview.everfolk.testnet", tokenId: "1" },
  });
  assert.equal(granary.demo?.household.grain, before + GRANARY_GRAIN);
  assert.equal(granary.journal.some(entry => entry.type === "influence" && entry.id === "farming.stock-granary" && entry.source?.tokenId === "1"), true);
  const seeded = engine.influence(started, {
    type: "influence", mode: "apply", entry: "farming.share-seed", power: 1,
    source: { contractId: "preview.everfolk.testnet", tokenId: "2" },
  });
  assert.equal(seeded.demo?.household.harvestBonusBps, SEED_BONUS_BPS);
  assert.deepEqual(DEMO_DEED_INFLUENCES.find(entry => entry.id === "military.guard-road")?.effects?.[0], {
    type: "demo", effect: { kind: "convoy", action: "depart", riskCutBps: 2000 },
  });
});

async function signed(life: { seed: string; life_id: string; account_id: string; world_version: string; draws: { token_id: string | null }[] }, career: Evidence["career_group"]): Promise<SignedEvidence> {
  const evidence: Evidence = {
    v: 1, seed: life.seed, life_id: life.life_id, account_id: life.account_id, world_version: life.world_version,
    world_fingerprint: "f".repeat(64), save_hash: "e".repeat(64), stats: { bonds: 40 }, skills: {}, origin_id: "tenant-household",
    peak_job_id: "tenant-farmer", accomplishments: [], death_age: 48, birth_year: -350, death_year: -302,
    career_group: career, matched_figures: [],
    sources: life.draws.filter(draw => draw.token_id).map(draw => ({ token_id: draw.token_id as string, impact: 30000 })),
  };
  const evidence_json = canonicalJson(evidence);
  return { evidence, evidence_json, evidence_hash: await sha256Hex(evidence_json), signature: "cd".repeat(64), verifier_kind: "server-signer" };
}

test("practice ledger mints a Farming NFT and pays the granary's owner", async () => {
  const ledger = createMockContract({ genesis: false, nobodyWeightBps: 0, accountId: "player.testnet" });
  const granary = ledger.seedToken({
    owner_id: "life-a.demo.testnet", kind: "npc", career_group: "farming", action_id: "farming.stock-granary", rarity: 0, affection: 80,
  });
  ledger.seedToken({ owner_id: "other.testnet", kind: "npc", career_group: "military", action_id: "military.mentor", rarity: 0, affection: 100 });
  const player = ledger.as("player.testnet");
  const life = await player.startLife(DEMO_WORLD_VERSION);
  const draw = await player.drawNpc(life.life_id, 0, "harvest", HASH);
  assert.equal(draw.token_id, granary);
  assert.equal(draw.action_id, "farming.stock-granary");
  const stored = await player.getLife(life.life_id);
  assert.ok(stored);
  const minted = await player.mintLife(life.life_id, await signed(stored, "farming"), "farming.stock-granary");
  assert.equal(minted.kind, "npc");
  const token = await player.token(minted.token_id);
  assert.equal(token?.extra.career_group, "farming");
  assert.equal(token?.extra.action_id, "farming.stock-granary");
  const fee = BigInt((await player.mintTerms()).mint_fee);
  assert.equal(await player.balanceOf("life-a.demo.testnet"), (fee / 2n).toString());
});

test("a harvest draw does not take a war token, and a ranked life can still start", async () => {
  const ledger = createMockContract({ genesis: false, nobodyWeightBps: 0, abandonCooldownMs: 0, accountId: "player.testnet" });
  ledger.seedToken({ owner_id: "war.testnet", kind: "npc", career_group: "military", action_id: "military.mentor", rarity: 1, affection: 100 });
  const player = ledger.as("player.testnet");
  const demo = await player.startLife(DEMO_WORLD_VERSION);
  const harvest = await player.drawNpc(demo.life_id, 0, "harvest", HASH);
  assert.equal(harvest.token_id, null);
  await player.abandonLife(demo.life_id);
  const ranked = await player.startLife(RANKED_WORLD_VERSION);
  assert.equal(ranked.world_version, RANKED_WORLD_VERSION);
  await assert.rejects(player.drawNpc(ranked.life_id, 0, "not-a-category", HASH), /Unknown category/);
});

test("a trade command replays as a demo command, not an unknown command", () => {
  const engine = createEngine(ensureDemoDeeds(demoWorld as unknown as WorldPack));
  let started = engine.start("trade-replay");
  for (let step = 0; step < 400 && (started.age < 12 || started.phase !== "ready"); step++) {
    started = started.phase === "choice" ? engine.choose(started, engine.getChoices(started)[0].id) : engine.advance(started);
  }
  const traded = engine.demo(started, { type: "trade", item: "grain", side: "sell", quantity: 1, counterparty: "merchant" });
  assert.equal(traded.commands.at(-1)?.type, "trade");
  const replayed = stepCommand(engine, started, { type: "trade", item: "grain", side: "sell", quantity: 1, counterparty: "merchant" });
  assert.equal(replayed.commands.at(-1)?.type, "trade");
  assert.equal(traded.demo?.household.grain, (started.demo?.household.grain ?? 0) - 1);
});
