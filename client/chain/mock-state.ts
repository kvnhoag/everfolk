import { FIGURE_ACTIONS, FIGURE_IDS, NPC_ACTIONS, RANKED_WORLD_VERSION } from "../../chain/ids.ts";
import type { CareerGroup, Category, FigureId } from "../../chain/ids.ts";
import type { LifeView, Listing, SourceShare, TokenExtra } from "../../chain/types.ts";

/** In-memory ledger behind `createMockContract`. Mirrors the contract's storage, not its gas or storage costs. */

export interface MockOptions {
  /** Account the returned contract acts as. Default `player.testnet`. */
  accountId?: string;
  /** Pre-mint one copy of each figure and one NPC per career group, owned by `genesis.testnet`. Default true. */
  genesis?: boolean;
  /** Clock for `started_at_ms` and the abandon cooldown. Default `Date.now`. */
  now?: () => number;
  abandonCooldownMs?: number;
  mintFeeYocto?: string;
  dropRateBps?: number;
  nobodyWeightBps?: number;
  figureSupplyCap?: number;
  worldVersions?: readonly string[];
  treasuryId?: string;
}

export interface MockToken {
  owner_id: string;
  kind: "figure" | "npc";
  figure_id: FigureId | null;
  /** Pool category for NPCs; null for figures. */
  category: Category | null;
  rarity: number;
  affection: number;
  action_id: string;
  extra: TokenExtra;
}

export interface SeedTokenInput {
  owner_id: string;
  kind: "figure" | "npc";
  figure_id?: FigureId;
  career_group?: CareerGroup;
  action_id?: string;
  rarity: number;
  affection: number;
}

export interface MockParams {
  now: () => number;
  abandonCooldownMs: number;
  mintFee: bigint;
  dropRateBps: number;
  nobodyWeightBps: number;
  figureSupplyCap: number;
  worldVersions: readonly string[];
  treasuryId: string;
  sourceMintShareBps: number;
  royaltySourcesBps: number;
  royaltyTreasuryBps: number;
}

export interface MockState {
  params: MockParams;
  counters: { nextLifeId: number; nextTokenId: number };
  lives: Map<string, LifeView>;
  activeLife: Map<string, string>;
  abandonedAt: Map<string, number>;
  tokens: Map<string, MockToken>;
  npcPools: Map<Category, string[]>;
  figureCopies: Map<FigureId, string[]>;
  balances: Map<string, bigint>;
  sources: Map<string, SourceShare[]>;
  children: Map<string, string[]>;
  stats: Map<string, { lives_influenced: number; earned: bigint }>;
  listings: Map<string, Listing>;
}

export const GENESIS_OWNER = "genesis.testnet";
export const MAX_RECORDS_PER_LIFE = 128;
export const MAX_POOL = 1000;

const FIGURE_CAREER: Record<FigureId, CareerGroup> = { alexander: "military", aristotle: "letters", euclid: "letters", cleomenes: "commerce" };

export function groupOfNpcAction(actionId: string): CareerGroup | null {
  const entry = Object.entries(NPC_ACTIONS).find(([, group]) => (group.actions as readonly string[]).includes(actionId));
  return entry ? (entry[0] as CareerGroup) : null;
}

export function createState(options: MockOptions): MockState {
  return {
    params: {
      now: options.now ?? Date.now,
      abandonCooldownMs: options.abandonCooldownMs ?? 600_000,
      mintFee: BigInt(options.mintFeeYocto ?? (10n ** 24n).toString()),
      dropRateBps: options.dropRateBps ?? 500,
      nobodyWeightBps: options.nobodyWeightBps ?? 5000,
      figureSupplyCap: options.figureSupplyCap ?? 25,
      worldVersions: options.worldVersions ?? [RANKED_WORLD_VERSION],
      treasuryId: options.treasuryId ?? "treasury.testnet",
      sourceMintShareBps: 5000,
      royaltySourcesBps: 500,
      royaltyTreasuryBps: 500,
    },
    counters: { nextLifeId: 1, nextTokenId: 1 },
    lives: new Map(), activeLife: new Map(), abandonedAt: new Map(), tokens: new Map(),
    npcPools: new Map(), figureCopies: new Map(), balances: new Map(), sources: new Map(),
    children: new Map(), stats: new Map(), listings: new Map(),
  };
}

/** Adds a minted token to the pool it can influence from (NPC pools stop growing at MAX_POOL, like the contract). */
export function addToPool(state: MockState, tokenId: string, token: MockToken): void {
  if (token.kind === "figure" && token.figure_id) {
    state.figureCopies.set(token.figure_id, [...(state.figureCopies.get(token.figure_id) ?? []), tokenId]);
  } else if (token.category) {
    const members = state.npcPools.get(token.category) ?? [];
    if (members.length < MAX_POOL) state.npcPools.set(token.category, [...members, tokenId]);
  }
}

export function registerToken(state: MockState, token: MockToken): string {
  const tokenId = String(state.counters.nextTokenId);
  state.counters = { ...state.counters, nextTokenId: state.counters.nextTokenId + 1 };
  state.tokens.set(tokenId, token);
  addToPool(state, tokenId, token);
  return tokenId;
}

/** Mints a token outside the life flow (genesis / fixtures). */
export function seedToken(state: MockState, input: SeedTokenInput): string {
  const figureId = input.kind === "figure" ? input.figure_id ?? null : null;
  if (input.kind === "figure" && !figureId) throw new Error("A figure token needs a figure_id.");
  const careerGroup = input.career_group ?? (figureId ? FIGURE_CAREER[figureId] : null);
  if (!careerGroup) throw new Error("An NPC token needs a career_group.");
  const actionId = input.action_id ?? (figureId ? FIGURE_ACTIONS[figureId][0] : NPC_ACTIONS[careerGroup].actions[0]);
  const category = figureId ? null : NPC_ACTIONS[groupOfNpcAction(actionId) ?? careerGroup].category;
  return registerToken(state, {
    owner_id: input.owner_id, kind: input.kind, figure_id: figureId, category, rarity: input.rarity, affection: input.affection, action_id: actionId,
    extra: {
      kind: input.kind, figure_id: figureId, rarity: input.rarity, affection: input.affection, action_id: actionId, life_id: "0",
      birth_year: -350, death_year: -290, career_group: careerGroup, sources: [], evidence_hash: "0".repeat(64),
    },
  });
}

export function seedGenesis(state: MockState): void {
  FIGURE_IDS.forEach((figure_id, index) => {
    seedToken(state, { owner_id: GENESIS_OWNER, kind: "figure", figure_id, rarity: 2 + (index % 3), affection: 40 + index * 10 });
  });
  (Object.keys(NPC_ACTIONS) as CareerGroup[]).forEach((career_group, index) => {
    seedToken(state, { owner_id: GENESIS_OWNER, kind: "npc", career_group, rarity: index % 5, affection: 30 + index * 10 });
  });
}
