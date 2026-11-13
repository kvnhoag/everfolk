import { sha256Hex } from "../../chain/hash.ts";
import { FIGURE_ACTIONS, NPC_ACTIONS, type FigureId } from "../../chain/ids.ts";
import { figuresForWorld } from "../../chain/catalog/demo-figures.ts";
import { careerGroupOf, matchFigures, peakJobOf } from "../../chain/match.ts";
import type { CareerGroup } from "../../chain/ids.ts";
import { packCardCount } from "../../chain/pack-count.ts";
import type { Evidence, MintCard, MintPack, MintResult } from "../../chain/types.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { DEFAULT_MARKET_TERMS } from "../chain/payout-preview.ts";
import { roll, weightedPick } from "../chain/mock-math.ts";
import type { LivesContract } from "../chain/types.ts";

const NPC_RARITY_WEIGHTS = [6000n, 2500n, 1000n, 400n, 100n];
const FIGURE_RARITY_WEIGHTS = [0n, 0n, 7000n, 2500n, 500n];

/** Skill → career group, for free lives that never held a ranked job (for example a household farm). */
const SKILL_GROUPS: Readonly<Record<string, CareerGroup>> = {
  farming: "farming", craft: "craft", pottery: "craft", carving: "craft", sculpture: "craft", warfare: "military",
  literacy: "letters", philosophy: "letters", oratory: "letters", reckoning: "commerce", trading: "commerce",
  seamanship: "commerce", astronomy: "sky", astrology: "sky", music: "performance",
};

function freePlayCareerGroup(life: LifeState): CareerGroup {
  if (peakJobOf(life)) return careerGroupOf(life);
  const strongest = Object.entries(life.character?.skills ?? {})
    .filter(([skill]) => SKILL_GROUPS[skill])
    .sort(([, a], [, b]) => b - a)[0];
  return strongest && strongest[1] > 0 ? SKILL_GROUPS[strongest[0]] : careerGroupOf(life);
}

function birthYearOf(life: LifeState, world: WorldPack): number {
  const birth = life.journal.find(entry => entry.type === "birth");
  return birth?.year ?? world.startYear;
}

/** Pure deterministic evidence generation for a free-play (not-weave) finished life. */
export async function generateFreePlayEvidence(life: LifeState, world: WorldPack): Promise<Evidence> {
  const seed = life.seed || "freeplay-seed";
  const birthYear = birthYearOf(life, world);
  const careerGroup = freePlayCareerGroup(life);
  const worldVersion = world.version || "alexandria-demo-2";
  const matched = matchFigures(life, figuresForWorld(worldVersion));

  return {
    v: 1,
    seed,
    life_id: `freeplay-${seed.slice(0, 16)}`,
    account_id: "freeplay.local",
    world_version: world.version,
    world_fingerprint: life.worldFingerprint ?? "freeplay",
    save_hash: await sha256Hex(`freeplay-save:${seed}`),
    stats: { ...life.stats },
    skills: { ...life.character?.skills },
    origin_id: life.originId,
    peak_job_id: peakJobOf(life),
    accomplishments: (life.accomplishments ?? []).map(record => ({ id: record.achievementId, age: record.age })),
    death_age: life.age,
    birth_year: birthYear,
    death_year: life.year,
    career_group: careerGroup,
    matched_figures: matched,
    sources: [],
  };
}

async function rollCardOutcome(seed: string, evidence: Evidence) {
  let figure: FigureId | null = null;
  for (const candidate of evidence.matched_figures) {
    if ((await roll(seed, `drop:${candidate}`)) % 10_000n < 2500n) {
      figure = candidate;
      break;
    }
  }
  const rarity = weightedPick(figure ? FIGURE_RARITY_WEIGHTS : NPC_RARITY_WEIGHTS, await roll(seed, "rarity")) ?? 0;
  const bonds = Math.trunc(Math.max(-1e6, Math.min(1e6, evidence.stats.bonds ?? 50)));
  const affection = Math.max(1, Math.min(100, 1 + Number((await roll(seed, "aff")) % 100n) + Math.trunc((bonds - 50) / 5)));
  return { figure, rarity, affection };
}

async function generatePackCard(seed: string, hash: string, slot: number, evidence: Evidence, groupActions: readonly string[]): Promise<MintCard> {
  const cardSeed = await sha256Hex(`${seed}:pack:${hash}:${slot}`);
  const { figure, rarity, affection } = await rollCardOutcome(cardSeed, evidence);
  // Neighbouring slots offer the group's different deeds, so a pack never repeats one card three times.
  const actionId = figure ? FIGURE_ACTIONS[figure][0] : groupActions[slot % groupActions.length];
  return {
    kind: figure ? "figure" : "npc",
    figure_id: figure,
    rarity,
    affection,
    action_id: actionId,
  };
}

export interface FreePlayBoosterSession {
  pack: MintPack;
  evidence: Evidence;
  contract: LivesContract;
}

/**
 * Builds an offline, seeded 1–5 card booster pack preview (0 before age 18) for an ended free-play life.
 * No network calls, no on-chain actions, no rerolls, fully deterministic from life.seed.
 */
export async function createFreePlayBooster(life: LifeState, world: WorldPack): Promise<FreePlayBoosterSession> {
  const evidence = await generateFreePlayEvidence(life, world);
  const groupActions: readonly string[] = NPC_ACTIONS[evidence.career_group]?.actions ?? ["letters.teach"];
  const evidenceHash = await sha256Hex(JSON.stringify(evidence));
  const seed = evidence.seed;
  const cardCount = packCardCount(evidence);

  const cards: MintCard[] = [];
  for (let slot = 0; slot < cardCount; slot++) {
    cards.push(await generatePackCard(seed, evidenceHash, slot, evidence, groupActions));
  }

  const packView: MintPack = {
    life_id: evidence.life_id,
    evidence_hash: evidenceHash,
    cards,
    total_fee: "0",
    source_share_bps: 5000,
  };

  const packRef = { view: structuredClone(packView) };

  // Lightweight in-memory preview contract stub (minting is blocked outside Weave Mode)
  const contract: LivesContract = {
    async stageMintQuote() { throw new Error("Free-play albums are kept locally. Play Weave Mode to mint on NEAR."); },
    async mintStageFigures() { throw new Error("Free-play albums are kept locally. Play Weave Mode to mint on NEAR."); },
    async retryStageMint() { throw new Error("Free-play has no paid stage mint to recover."); },
    async stageMintResult() { return null; },
    async mintTerms() {
      return { mint_fee: "0", source_share_bps: 5000, pack_version: 1 };
    },
    async marketTerms() {
      return { ...DEFAULT_MARKET_TERMS };
    },
    async mintPack(lifeId: string) {
      if (lifeId !== packRef.view.life_id) return null;
      return structuredClone(packRef.view);
    },
    async openMintPack() {
      return structuredClone(packRef.view);
    },
    async chooseMintSlot(): Promise<MintResult> {
      throw new Error("Only Weave Mode can mint cards to NFT.");
    },
    async mintLife(): Promise<MintResult> {
      throw new Error("Free-play lives are not minted to NEAR. Play Weave Mode to mint on chain.");
    },
    async startLife() { throw new Error("Free-play lives are managed locally."); },
    async abandonLife() {},
    async drawNpc() { throw new Error("Not supported in free-play."); },
    async checkpoint() {},
    async getLife() { return null; },
    async activeLifeOf() { return null; },
    async figureCopies() { return []; },
    async figureSupply() { return [0, 0]; },
    async retryMint(): Promise<MintResult> { throw new Error("Not supported in free-play."); },
    async mintResult() { return null; },
    async setAction() {},
    async withdraw() {},
    async balanceOf() { return "0"; },
    async token() { return null; },
    async tokensOf() { return []; },
    async tokenStats() { return { lives_influenced: 0, earned: "0" }; },
    async childrenOf() { return []; },
    async list() {},
    async unlist() {},
    async buy() { return "0"; },
    async listings() { return []; },
  };

  return { pack: packView, evidence, contract };
}
