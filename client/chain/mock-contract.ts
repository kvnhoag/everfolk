import { sha256Hex } from "../../chain/hash.ts";
import { FIGURE_ACTIONS, FIGURE_IDS, NPC_ACTIONS } from "../../chain/ids.ts";
import type { Category, FigureId } from "../../chain/ids.ts";
import type { Draw, Evidence, FigurePick, LifeView, MintResult } from "../../chain/types.ts";
import { roll, weightedPick } from "./mock-math.ts";
import { buy, list, payMintFee, setAction, unlist, withdraw } from "./mock-market.ts";
import {
  createState, groupOfNpcAction, MAX_RECORDS_PER_LIFE, registerToken, seedGenesis, seedToken,
  type MockOptions, type MockState, type SeedTokenInput,
} from "./mock-state.ts";
import type { LivesContract, SignedEvidence } from "./types.ts";
import { assertCategory, assertCommandsHash, assertLifeId, assertStep } from "./validate.ts";

export type { MockOptions, SeedTokenInput } from "./mock-state.ts";

/** In-memory lives contract for UI work and tests. Same rules and errors as the Rust contract; deterministic rolls. */
export interface MockLivesContract extends LivesContract {
  readonly accountId: string;
  /** The same ledger, acting as another account (e.g. a buyer or a source owner). */
  as(accountId: string): MockLivesContract;
  /** Mints a token directly, as genesis seeding would. Returns its token id. */
  seedToken(input: SeedTokenInput): string;
}

const NPC_RARITY_WEIGHTS = [6000n, 2500n, 1000n, 400n, 100n];
const FIGURE_RARITY_WEIGHTS = [0n, 0n, 7000n, 2500n, 500n];

const copy = <T>(value: T): T => structuredClone(value);

function ownedAliveLife(state: MockState, account: string, lifeId: string): LifeView {
  assertLifeId(lifeId);
  const life = state.lives.get(lifeId);
  if (!life) throw new Error("Life not found");
  if (life.account_id !== account) throw new Error("Only the life's owner can do this");
  if (life.status !== "alive") throw new Error("This life is no longer in progress");
  return life;
}

/** Draws and checkpoints only move forward; records sharing a step must agree on its hash. */
function assertNextStep(life: LifeView, step: number, hash: string): void {
  for (const record of [...life.draws, ...life.checkpoints]) {
    if (step < record.step) throw new Error("Steps must not go backwards");
    if (step === record.step && record.commands_hash !== hash) throw new Error("A different record already exists at this step");
  }
}

async function pickFigures(state: MockState, seed: string): Promise<FigurePick[]> {
  const picks: FigurePick[] = [];
  for (const figureId of FIGURE_IDS) {
    const copies = state.figureCopies.get(figureId) ?? [];
    const index = weightedPick(copies.map(id => BigInt(state.tokens.get(id)?.affection ?? 0)), await roll(seed, `fig:${figureId}`));
    const token = index === null ? undefined : state.tokens.get(copies[index]);
    if (index !== null && token) picks.push({ figure_id: figureId, token_id: copies[index], action_id: token.action_id, rarity: token.rarity });
  }
  return picks;
}

async function pickNpc(state: MockState, life: LifeView, step: number, category: Category, hash: string): Promise<Draw> {
  const pool = state.npcPools.get(category) ?? [];
  const weights = pool.map(id => BigInt(state.tokens.get(id)?.affection ?? 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  const nobody = BigInt(state.params.nobodyWeightBps);
  const index = weightedPick([...weights, (nobody * total) / (10_000n - nobody)], await roll(life.seed, `draw:${step}:${category}`));
  const token = index !== null && index < pool.length ? state.tokens.get(pool[index]) : undefined;
  return {
    step, category, commands_hash: hash,
    token_id: token ? pool[index as number] : null, action_id: token?.action_id ?? null, rarity: token?.rarity ?? null,
  };
}

function parseEvidence(signed: SignedEvidence): Evidence {
  if (!/^[0-9a-f]{128}$/.test(signed.signature)) throw new Error("Signature must be 128 hex characters");
  try {
    return JSON.parse(signed.evidence_json) as Evidence;
  } catch {
    throw new Error("The life evidence is not in the expected format");
  }
}

function assertEvidence(life: LifeView, evidence: Evidence, npcActionId: string): void {
  if (evidence.v !== 1) throw new Error("Unsupported evidence version");
  if (evidence.life_id !== life.life_id || evidence.account_id !== life.account_id) throw new Error("Evidence belongs to a different life or account");
  if (evidence.seed !== life.seed) throw new Error("Evidence was made for a different life seed");
  if (evidence.world_version !== life.world_version) throw new Error("Evidence is for a different world version");
  const influenced = new Set([...life.figure_picks.map(pick => pick.token_id), ...life.draws.map(draw => draw.token_id)]);
  if (!evidence.sources.every(source => influenced.has(source.token_id))) throw new Error("A source did not influence this life on chain");
  if (!evidence.matched_figures.every(figure => (FIGURE_IDS as readonly string[]).includes(figure))) throw new Error("Unknown figure");
  if (groupOfNpcAction(npcActionId) !== evidence.career_group) throw new Error("This action does not belong to the life's career");
}

async function rollOutcome(state: MockState, seed: string, evidence: Evidence) {
  let figure: FigureId | null = null;
  for (const candidate of evidence.matched_figures) {
    const minted = state.figureCopies.get(candidate)?.length ?? 0;
    if (minted < state.params.figureSupplyCap && (await roll(seed, `drop:${candidate}`)) % 10_000n < BigInt(state.params.dropRateBps)) {
      figure = candidate;
      break;
    }
  }
  const rarity = weightedPick(figure ? FIGURE_RARITY_WEIGHTS : NPC_RARITY_WEIGHTS, await roll(seed, "rarity")) ?? 0;
  const bonds = Math.trunc(Math.max(-1e6, Math.min(1e6, evidence.stats.bonds ?? 50)));
  const affection = Math.max(1, Math.min(100, 1 + Number((await roll(seed, "aff")) % 100n) + Math.trunc((bonds - 50) / 5)));
  return { figure, rarity, affection };
}

async function mintLife(state: MockState, account: string, lifeId: string, signed: SignedEvidence, npcActionId: string): Promise<MintResult> {
  const evidence = parseEvidence(signed);
  const life = ownedAliveLife(state, account, lifeId);
  assertEvidence(life, evidence, npcActionId);
  const evidenceHash = await sha256Hex(signed.evidence_json);
  const { figure, rarity, affection } = await rollOutcome(state, await sha256Hex(`${life.seed}:${evidenceHash}`), evidence);
  const actionId = figure ? FIGURE_ACTIONS[figure][0] : npcActionId;
  const kind = figure ? "figure" : "npc";
  const category = figure ? null : NPC_ACTIONS[evidence.career_group].category;
  const tokenId = registerToken(state, {
    owner_id: life.account_id, kind, figure_id: figure, category, rarity, affection, action_id: actionId,
    extra: {
      kind, figure_id: figure, rarity, affection, action_id: actionId, life_id: life.life_id, birth_year: evidence.birth_year,
      death_year: evidence.death_year, career_group: evidence.career_group, sources: [], evidence_hash: evidenceHash,
    },
  });
  const shares = payMintFee(state, tokenId, evidence.sources);
  const token = state.tokens.get(tokenId);
  if (token) state.tokens.set(tokenId, { ...token, extra: { ...token.extra, sources: shares } });
  state.lives.set(lifeId, { ...life, status: "minted" });
  state.activeLife.delete(life.account_id);
  return { token_id: tokenId, kind, figure_id: figure, rarity, affection };
}

function bind(state: MockState, account: string): MockLivesContract {
  return {
    accountId: account,
    as: other => bind(state, other),
    seedToken: input => seedToken(state, input),

    async startLife(worldVersion) {
      if (!state.params.worldVersions.includes(worldVersion)) throw new Error("This world version is not open for ranked play");
      if (state.activeLife.has(account)) throw new Error("You already have a ranked life in progress");
      const abandoned = state.abandonedAt.get(account);
      const now = state.params.now();
      if (abandoned !== undefined && now < abandoned + state.params.abandonCooldownMs) {
        throw new Error(`Your next ranked life opens in ${Math.ceil((abandoned + state.params.abandonCooldownMs - now) / 1000)} seconds`);
      }
      const lifeId = String(state.counters.nextLifeId);
      state.counters = { ...state.counters, nextLifeId: state.counters.nextLifeId + 1 };
      const seed = await sha256Hex(`everfolk-mock-life:${lifeId}:${account}`);
      const life: LifeView = {
        life_id: lifeId, account_id: account, seed, world_version: worldVersion, status: "alive",
        figure_picks: await pickFigures(state, seed), draws: [], checkpoints: [], started_at_ms: now,
      };
      state.lives.set(lifeId, life);
      state.activeLife.set(account, lifeId);
      return copy(life);
    },
    async abandonLife(lifeId) {
      const life = ownedAliveLife(state, account, lifeId);
      state.lives.delete(lifeId);
      state.activeLife.delete(life.account_id);
      state.abandonedAt.set(life.account_id, state.params.now());
    },
    async drawNpc(lifeId, step, category, commandsHash) {
      assertCommandsHash(commandsHash);
      assertCategory(category);
      assertStep(step);
      const life = ownedAliveLife(state, account, lifeId);
      const existing = life.draws.find(draw => draw.step === step);
      if (existing) {
        if (existing.commands_hash !== commandsHash) throw new Error("A different record already exists at this step");
        return copy(existing);
      }
      assertNextStep(life, step, commandsHash);
      if (life.draws.length >= MAX_RECORDS_PER_LIFE) throw new Error("This life has reached its draw limit");
      const draw = await pickNpc(state, life, step, category, commandsHash);
      state.lives.set(lifeId, { ...life, draws: [...life.draws, draw] });
      return copy(draw);
    },
    async checkpoint(lifeId, step, commandsHash) {
      assertCommandsHash(commandsHash);
      assertStep(step);
      const life = ownedAliveLife(state, account, lifeId);
      assertNextStep(life, step, commandsHash);
      if (life.checkpoints.some(checkpoint => checkpoint.step === step)) return;
      if (life.checkpoints.length >= MAX_RECORDS_PER_LIFE) throw new Error("This life has reached its checkpoint limit");
      state.lives.set(lifeId, { ...life, checkpoints: [...life.checkpoints, { step, commands_hash: commandsHash }] });
    },
    async getLife(lifeId) {
      assertLifeId(lifeId);
      const life = state.lives.get(lifeId);
      return life ? copy(life) : null;
    },
    async activeLifeOf(owner) {
      const lifeId = state.activeLife.get(owner);
      const life = lifeId === undefined ? undefined : state.lives.get(lifeId);
      return life ? copy(life) : null;
    },
    mintLife: (lifeId, signed, npcActionId) => mintLife(state, account, lifeId, signed, npcActionId),
    async setAction(tokenId, actionId) {
      setAction(state, account, tokenId, actionId);
    },
    async withdraw() {
      withdraw(state, account);
    },
    async balanceOf(owner) {
      return (state.balances.get(owner) ?? 0n).toString();
    },
    async token(tokenId) {
      const token = state.tokens.get(tokenId);
      return token ? { owner_id: token.owner_id, extra: copy(token.extra) } : null;
    },
    async tokensOf(owner) {
      return [...state.tokens.entries()].filter(([, token]) => token.owner_id === owner)
        .map(([token_id, token]) => ({ token_id, owner_id: token.owner_id, extra: copy(token.extra) }));
    },
    async tokenStats(tokenId) {
      const stats = state.stats.get(tokenId);
      return { lives_influenced: stats?.lives_influenced ?? 0, earned: (stats?.earned ?? 0n).toString() };
    },
    async childrenOf(tokenId) {
      return [...(state.children.get(tokenId) ?? [])];
    },
    async list(tokenId, priceYocto) {
      list(state, account, tokenId, priceYocto);
    },
    async unlist(tokenId) {
      unlist(state, account, tokenId);
    },
    async buy(tokenId, priceYocto) {
      return buy(state, account, tokenId, priceYocto);
    },
    async listings() {
      return [...state.listings.values()].map(copy);
    },
  };
}

/** A fresh in-memory contract. By default it holds a small genesis set so lives get figure picks and draws. */
export function createMockContract(options: MockOptions = {}): MockLivesContract {
  const state = createState(options);
  if (options.genesis ?? true) seedGenesis(state);
  return bind(state, options.accountId ?? "player.testnet");
}
