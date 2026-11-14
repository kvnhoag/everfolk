import { DEMO_WORLD_VERSION } from "../../chain/ids.ts";
import { GRANARY_GRAIN } from "../../chain/catalog/demo-deeds.ts";
import { createMockContract, type MockLivesContract } from "./mock-contract.ts";
import type { LifeEngine, LifeState, WorldPack } from "../../src/types.ts";
import type { MintResult, SignedEvidence } from "./types.ts";
import { createEngine } from "../../src/index.ts";
import { registerWorldPack } from "../lib/world-session.ts";
import { selectAutomaticChoice } from "../models/yearly-focus.ts";
import { orderPreview } from "../demo/screen.ts";
import { beginRankedSession, type RankedSession, type SessionStorage } from "./ranked-session.ts";
import { PRACTICE_CONTRACT_ID, practiceVerifier } from "./practice-verifier.ts";
import type { EarnedCard } from "../../chain/earned-cards.ts";
import { loadLifeWorld } from "./life-world.ts";

/** Practice account that already holds Life A's Farming NFT. */
export const DEMO_LIFE_A_OWNER = "life-a.demo.testnet";
export const DEMO_SOLDIER_OWNER = "soldier-a.demo.testnet";

/**
 * The testing route builds lives from accepted commands, with its own in-memory ledger.
 * Only this fixture guarantees a harvest/road draw; normal gameplay retains its usual draw odds.
 */
export const DEMO_SCENARIO = {
  worldVersion: DEMO_WORLD_VERSION,
  lifeA: { owner: DEMO_LIFE_A_OWNER, careerGroup: "farming" as const, actionId: "farming.stock-granary" },
  comparison: "Replay the same commands with no harvest draw.",
};

export const DEMO_NEXT_OWNER = "next-life.demo.testnet";
const NEAR = 10n ** 24n;

const engines = new WeakMap<WorldPack, LifeEngine>();
function scenarioEngine(world: WorldPack): LifeEngine {
  let engine = engines.get(world);
  if (!engine) { engine = createEngine(world); engines.set(world, engine); }
  return engine;
}

function memoryStorage(): SessionStorage {
  const items = new Map<string, string>();
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => { items.set(key, value); }, removeItem: key => { items.delete(key); } };
}

/** Ordinary, deterministic farmer choices for preparing a fixture, never direct edits to life state. */
async function farmerStep(session: RankedSession, world: WorldPack): Promise<void> {
  const engine = scenarioEngine(world);
  if (session.state.phase === "choice") {
    const choices = session.choices();
    const choice = choices.find(item => item.id === "consult-healer") ?? selectAutomaticChoice(choices, world, session.state);
    if (!choice) throw new Error("The prepared life has no available choice.");
    await session.dispatch({ type: "choose", choice: choice.id });
    return;
  }
  const activities = engine.getActivities(session.state).filter(item => item.available);
  const activity = !session.state.character?.jobId ? activities.find(item => item.id === "work-farmhand") : null;
  const training = activity ?? activities.find(item => item.id === "train-farming");
  await session.dispatch(training ? { type: "act", activity: training.id } : { type: "advance" });
}

export async function fastForwardFarmer(session: RankedSession, world: WorldPack): Promise<void> {
  for (let step = 0; step < 1600 && session.state.phase !== "ended"; step++) await farmerStep(session, world);
  if (session.state.phase !== "ended") throw new Error("The prepared life did not reach its ending.");
}

export interface GranaryScenario {
  world: WorldPack;
  ledger: MockLivesContract;
  source: { state: LifeState; signed: SignedEvidence; minted: MintResult };
  next: RankedSession;
  beforeFlood: LifeState;
}

/** Prepare a completed farmer NFT, then advance a second life to just before its first poor harvest. */
export async function prepareGranaryScenario(): Promise<GranaryScenario> {
  const world = await loadLifeWorld(DEMO_WORLD_VERSION);
  registerWorldPack(world);
  const engine = scenarioEngine(world);
  const ledger = createMockContract({ genesis: false, nobodyWeightBps: 0, abandonCooldownMs: 0, accountId: DEMO_NEXT_OWNER });
  const sourceContract = ledger.as(DEMO_LIFE_A_OWNER);
  const source = await beginRankedSession({ contract: sourceContract, contractId: PRACTICE_CONTRACT_ID, world,
    verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, sourceContract) }, await sourceContract.startLife(world.version));
  await fastForwardFarmer(source, world);
  const signed = await source.finish();
  if (signed.evidence.career_group !== "farming") throw new Error("The prepared source life did not become a farmer.");
  const minted = await source.mint(signed, "farming.stock-granary");
  const next = await beginRankedSession({ contract: ledger, contractId: PRACTICE_CONTRACT_ID, world,
    verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, ledger) }, await ledger.startLife(world.version));
  for (let step = 0; step < 1200 && next.state.phase !== "ended"; step++) {
    if (next.state.phase === "ready" && engine.advance(next.state).pendingEventId === "flood-failure") {
      return { world, ledger, source: { state: source.state, signed, minted }, next, beforeFlood: next.state };
    }
    await farmerStep(next, world);
  }
  throw new Error("This prepared life did not reach a poor-harvest checkpoint.");
}

/** A counterfactual for display only; it cannot be minted as the recorded ranked life. */
export function withoutGranary(world: WorldPack, state: LifeState, sourceToken: string): LifeState {
  return scenarioEngine(world).replay(state.seed, state.commands.filter(command =>
    !(command.type === "influence" && command.entry === "farming.stock-granary" && command.source.tokenId === sourceToken)));
}

export async function openGranary(scenario: GranaryScenario): Promise<void> {
  if (scenario.next.state !== scenario.beforeFlood) throw new Error("This checkpoint is already open. Reset the test to replay it.");
  await scenario.next.dispatch({ type: "advance" });
  const state = scenario.next.state;
  if (state.pendingEventId !== "flood-failure" || !state.journal.some(entry => entry.source?.tokenId === scenario.source.minted.token_id)) {
    throw new Error("The poor-harvest draw did not apply the previous farmer's granary.");
  }
}

export async function settleGranaryYear(scenario: GranaryScenario): Promise<void> {
  const age = scenario.next.state.age;
  if (scenario.next.state.pendingEventId !== "flood-failure") throw new Error("Open the poor-harvest checkpoint first.");
  await scenario.next.dispatch({ type: "choose", choice: "flood-ration-keep-seed" });
  for (let step = 0; step < 100 && scenario.next.state.phase !== "ended" && scenario.next.state.age === age; step++) {
    if (scenario.next.state.phase === "choice") await farmerStep(scenario.next, scenario.world);
    else await scenario.next.dispatch({ type: "advance" });
  }
}

/** A practice ledger with Life A's granary deed already minted. No wallet. */
export function createDemoScenarioLedger(accountId = "player.testnet"): MockLivesContract {
  const ledger = createMockContract({ genesis: false, nobodyWeightBps: 0, abandonCooldownMs: 0, accountId });
  ledger.seedToken({
    owner_id: DEMO_LIFE_A_OWNER,
    kind: "npc",
    career_group: "farming",
    action_id: "farming.stock-granary",
    rarity: 0,
    affection: 80,
  });
  return ledger;
}

// ── Weave Feature Presets (separately testable in normal UI) ────────────────

export type WeavePresetId =
  | "granary"
  | "weave"
  | "career"
  | "nft"
  | "economy"
  | "convoy"
  | "pack"
  | "nft-pack"
  | "market"
  | "nft-market";

export interface WeavePresetMeta {
  id: WeavePresetId;
  label: string;
  shortLabel: string;
  summary: string;
}

export const WEAVE_PRESETS: readonly WeavePresetMeta[] = [
  {
    id: "granary",
    label: "1. Weave: Cross-Life Granary",
    shortLabel: "1. Cross-Life Weave",
    summary: `A previous farmer's NFT (#1 · Stock the granary) weaves into this household during a low flood, delivering ${GRANARY_GRAIN} grain.`,
  },
  {
    id: "career",
    label: "2. Career, Skill Tree & Stats",
    shortLabel: "2. Career & Skills",
    summary: "Prefilled adult life with trained skills, cash, stats, and resources so you can switch careers and inspect the skill tree.",
  },
  {
    id: "nft",
    label: "3. NFT: Verify, Pack, Royalties & Market",
    shortLabel: "3. NFT & Market",
    summary: "Completed Weave life ready to verify, pick a deed, open a 1–5 card booster pack, choose a card, mint, claim NEAR royalties, and trade on the market.",
  },
  {
    id: "economy",
    label: "4. Grain Market & Agents",
    shortLabel: "4. Market & Agents",
    summary: "Prefilled household with grain, harvested flax, flax plots, and cash ready to trade at the market and delegate to town agents.",
  },
  {
    id: "convoy",
    label: "5. Soldier & Convoy Weave",
    shortLabel: "5. Soldier & Convoy",
    summary: "Serving soldier on the supply road with a previous soldier's Guard the Road deed applied and full route risk preview.",
  },
  {
    id: "pack",
    label: "6. NFT: Booster Pack",
    shortLabel: "6. Pack & Mint",
    summary: "Completed Weave life with the 1–5 card booster pack already opened for choosing and minting one card.",
  },
  {
    id: "market",
    label: "7. NFT: Token Page, Royalties & Listings",
    shortLabel: "7. NFT Token & Market",
    summary: "Inspect your minted Farmer NFT (#1) with claimable NEAR royalties, change its deed, list it for sale, or buy from the Market.",
  },
];

export function normalizeWeavePreset(raw?: string | null): WeavePresetId {
  const key = (raw ?? "").trim().toLowerCase();
  if (key === "career" || key === "skills" || key === "jobs") return "career";
  if (key === "nft" || key === "mint") return "nft";
  if (key === "pack" || key === "nft-pack") return "pack";
  if (key === "market" || key === "nft-market" || key === "token") return "market";
  if (key === "economy" || key === "trade") return "economy";
  if (key === "convoy" || key === "soldier") return "convoy";
  if (key === "weave") return "weave";
  return "granary";
}

export interface PreparedWeavePreset {
  presetId: WeavePresetId;
  world: WorldPack;
  ledger: MockLivesContract;
  session: RankedSession;
  granary?: GranaryScenario;
  initialHash?: string;
}

/** Step a ranked session until it reaches a versatile adult state with skills, cash, grain, and flax ready. */
async function advanceToSkilledAdult(session: RankedSession, world: WorldPack): Promise<void> {
  const engine = scenarioEngine(world);
  const sellOrder = { type: "trade" as const, side: "sell" as const, item: "grain" as const, quantity: 100, counterparty: "merchant" as const };
  let plantedFlax = false;
  for (let step = 0; step < 600 && session.state.phase !== "ended"; step++) {
    const s = session.state;
    const acts = s.phase === "ready" ? engine.getActivities(s) : [];
    const canSwitch = acts.some(a => a.id === "work-grain-dealer" && a.available) && acts.some(a => a.id === "enlist-royal-army" && a.available);
    if (
      s.phase === "ready" &&
      canSwitch &&
      (s.character?.skills.warfare ?? 0) >= 20 &&
      (s.character?.skills.craft ?? 0) >= 12 &&
      (s.demo?.household.flax ?? 0) > 0 &&
      !orderPreview(world, s, sellOrder)
    ) {
      return;
    }
    if (s.phase === "choice") {
      const choices = session.choices();
      const pick = choices.find(c => c.id === "consult-healer") ?? selectAutomaticChoice(choices, world, s) ?? choices[0];
      await session.dispatch({ type: "choose", choice: pick.id });
      continue;
    }
    if (!plantedFlax && s.age >= 16 && (s.demo?.household.grain ?? 0) >= 600) {
      await session.dispatch({ type: "plan", flaxPlots: 1 });
      plantedFlax = true;
      continue;
    }
    if ((s.demo?.household.grain ?? 0) >= 550 && (s.economy?.cash ?? 0) < 160 && !orderPreview(world, s, sellOrder)) {
      await session.dispatch(sellOrder);
      continue;
    }
    const avail = acts.filter(a => a.available);
    const f = s.character?.skills.farming ?? 0;
    const r = s.character?.skills.reckoning ?? 0;
    const w = s.character?.skills.warfare ?? 0;
    const c = s.character?.skills.craft ?? 0;
    let act = null;
    if (!s.character?.jobId) act = avail.find(a => a.id === "work-farmhand");
    else if (s.character?.jobId === "farmhand" && avail.some(a => a.id === "work-tenant-farmer")) act = avail.find(a => a.id === "work-tenant-farmer");
    else if (f < 30 && avail.some(a => a.id === "train-farming")) act = avail.find(a => a.id === "train-farming");
    else if (r < 25 && avail.some(a => a.id === "train-reckoning")) act = avail.find(a => a.id === "train-reckoning");
    else if (w < 20 && avail.some(a => a.id === "train-warfare")) act = avail.find(a => a.id === "train-warfare");
    else if (c < 12 && avail.some(a => a.id === "train-craft")) act = avail.find(a => a.id === "train-craft");
    await session.dispatch(act ? { type: "act", activity: act.id } : { type: "advance" });
  }
}

function seedMarketplaceTokens(ledger: MockLivesContract): void {
  const euclid = ledger.seedToken({ owner_id: "alice.testnet", kind: "figure", figure_id: "euclid", action_id: "euclid.school", rarity: 2, affection: 68 });
  const cleomenes = ledger.seedToken({ owner_id: "bob.testnet", kind: "figure", figure_id: "cleomenes", action_id: "cleomenes.granaries", rarity: 4, affection: 84 });
  const alexander = ledger.seedToken({ owner_id: DEMO_NEXT_OWNER, kind: "figure", figure_id: "alexander", action_id: "alexander.found", rarity: 3, affection: 72 });
  const soldier = ledger.seedToken({ owner_id: DEMO_SOLDIER_OWNER, kind: "npc", career_group: "military", action_id: "military.guard-road", rarity: 2, affection: 76 });
  const scholar = ledger.seedToken({ owner_id: "alice.testnet", kind: "npc", career_group: "letters", action_id: "letters.teach", rarity: 1, affection: 64 });
  void ledger.as("alice.testnet").list(euclid, (3n * NEAR).toString());
  void ledger.as("bob.testnet").list(cleomenes, ((9n * NEAR) / 2n).toString());
  void ledger.as("alice.testnet").list(scholar, ((3n * NEAR) / 2n).toString());
  void alexander;
  void soldier;
}

/**
 * The pack and NFT presets preview an earned pack: Euclid's own Legendary card and the player's Epic
 * contributor card on his path, in the practice life's recorded sex. Lab only; real lives sign what they earned.
 */
function previewEarnedCards(evidence: { sex?: "male" | "female" }): EarnedCard[] {
  return [
    { card_id: "euclid-parent", figure_id: "euclid", kind: "principal", rarity: 4 },
    { card_id: `euclid-epic-${evidence.sex ?? "female"}`, figure_id: "euclid", kind: "contribution", rarity: 3 },
  ];
}

export async function prepareWeavePreset(
  presetId: WeavePresetId,
  options: { packPreopened?: boolean; weaveBeforeFlood?: boolean } = {},
): Promise<PreparedWeavePreset> {
  const world = await loadLifeWorld(DEMO_WORLD_VERSION);
  registerWorldPack(world);

  if (presetId === "granary" || presetId === "weave") {
    const granary = await prepareGranaryScenario();
    seedMarketplaceTokens(granary.ledger);
    if (!options.weaveBeforeFlood) {
      await openGranary(granary);
    }
    return { presetId, world, ledger: granary.ledger, session: granary.next, granary };
  }

  const ledger = createMockContract({ genesis: false, nobodyWeightBps: 0, abandonCooldownMs: 0, accountId: DEMO_NEXT_OWNER });
  ledger.seedToken({ owner_id: DEMO_LIFE_A_OWNER, kind: "npc", career_group: "farming", action_id: "farming.stock-granary", rarity: 2, affection: 82 });
  seedMarketplaceTokens(ledger);

  if (presetId === "career" || presetId === "economy") {
    const session = await beginRankedSession({
      contract: ledger, contractId: PRACTICE_CONTRACT_ID, world,
      verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, ledger),
    }, await ledger.startLife(world.version));
    await advanceToSkilledAdult(session, world);
    if (presetId === "economy" && session.state.character?.jobId !== "grain-dealer") {
      const acts = scenarioEngine(world).getActivities(session.state);
      if (acts.some(a => a.id === "work-grain-dealer" && a.available)) {
        await session.dispatch({ type: "act", activity: "work-grain-dealer" });
        await session.dispatch({ type: "advance" });
        while (session.state.phase === "choice") await farmerStep(session, world);
      }
    }
    return { presetId, world, ledger, session };
  }

  if (presetId === "convoy") {
    const session = await beginRankedSession({
      contract: ledger, contractId: PRACTICE_CONTRACT_ID, world,
      verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, ledger),
    }, await ledger.startLife(world.version));
    await advanceToSkilledAdult(session, world);
    await session.dispatch({ type: "act", activity: "enlist-royal-army" });
    for (let step = 0; step < 300 && session.state.phase !== "ended"; step++) {
      if (session.state.pendingEventId === "demo-convoy-road") break;
      if (session.state.phase === "choice") {
        const choices = session.choices();
        const pick =
          choices.find(c => c.id === "convoy-set-out-provisioned" || c.id === "convoy-set-out") ??
          choices.find(c => c.id === "consult-healer") ??
          selectAutomaticChoice(choices, world, session.state) ??
          choices[0];
        await session.dispatch({ type: "choose", choice: pick.id });
        continue;
      }
      await session.dispatch({ type: "advance" });
    }
    return { presetId, world, ledger, session };
  }

  if (presetId === "nft" || presetId === "pack" || presetId === "nft-pack") {
    // Seed an already-owned Farmer NFT by DEMO_NEXT_OWNER that helped carol.testnet so #mine / #token/2 also has claimable NEAR royalties!
    const earlierSession = await beginRankedSession({
      contract: ledger, contractId: PRACTICE_CONTRACT_ID, world,
      verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, ledger),
    }, await ledger.startLife(world.version));
    await fastForwardFarmer(earlierSession, world);
    const earlierSigned = await earlierSession.finish();
    await earlierSession.mint(earlierSigned, "farming.stock-granary");

    const carolContract = ledger.as("carol.testnet");
    const carolSession = await beginRankedSession({
      contract: carolContract, contractId: PRACTICE_CONTRACT_ID, world,
      verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, carolContract),
    }, await carolContract.startLife(world.version));
    await fastForwardFarmer(carolSession, world);
    const carolSigned = await carolSession.finish();
    await carolSession.mint(carolSigned, "farming.share-seed");

    const session = await beginRankedSession({
      contract: ledger, contractId: PRACTICE_CONTRACT_ID, world,
      verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, ledger, PRACTICE_CONTRACT_ID, previewEarnedCards),
    }, await ledger.startLife(world.version));
    await fastForwardFarmer(session, world);
    const shouldPreopenPack = presetId === "pack" || presetId === "nft-pack" ? options.packPreopened !== false : Boolean(options.packPreopened);
    if (shouldPreopenPack) {
      const signed = await session.finish();
      await ledger.openMintPack(session.life.life_id, signed, "farming.stock-granary");
    }
    return { presetId, world, ledger, session };
  }

  // presetId === "market" | "nft-market": Player owns Token #1 (a verified Farmer NFT with royalties from child lives)
  const marketLedger = createMockContract({ genesis: false, nobodyWeightBps: 0, abandonCooldownMs: 0, accountId: DEMO_NEXT_OWNER });
  const playerSession = await beginRankedSession({
    contract: marketLedger, contractId: PRACTICE_CONTRACT_ID, world,
    verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, marketLedger),
  }, await marketLedger.startLife(world.version));
  await fastForwardFarmer(playerSession, world);
  const playerSigned = await playerSession.finish();
  const ownedToken = await playerSession.mint(playerSigned, "farming.stock-granary");

  // Seed a second life by another player that draws Token #1 and mints, paying royalties to DEMO_NEXT_OWNER!
  const otherContract = marketLedger.as("carol.testnet");
  const childSession = await beginRankedSession({
    contract: otherContract, contractId: PRACTICE_CONTRACT_ID, world,
    verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, otherContract),
  }, await otherContract.startLife(world.version));
  await fastForwardFarmer(childSession, world);
  const childSigned = await childSession.finish();
  await childSession.mint(childSigned, "farming.share-seed");

  seedMarketplaceTokens(marketLedger);
  const activeSession = await beginRankedSession({
    contract: marketLedger, contractId: PRACTICE_CONTRACT_ID, world,
    verifyUrl: "", storage: memoryStorage(), verifyLocally: practiceVerifier(world, marketLedger),
  }, await marketLedger.startLife(world.version));
  await advanceToSkilledAdult(activeSession, world);
  return { presetId, world, ledger: marketLedger, session: activeSession, initialHash: `#token/${ownedToken.token_id}` };
}
