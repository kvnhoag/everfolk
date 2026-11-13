import type { NpcSessionAttestation } from "../../chain/npc-proof.ts";
import type { Command, LifeState, WorldPack } from "../../src/types.ts";
import type { ContentDatabase } from "../db/types.ts";
import type { NpcProviderStatus } from "./provider-status.ts";

export interface RankedNpcSessionSnapshot {
  sessionId: string;
  contractId: string;
  lifeId: string;
  accountId: string;
  seed: string;
  worldVersion: string;
  worldFingerprint: string;
  revision: number;
  state: LifeState;
  rewardEligible: boolean;
  hadFallback: boolean;
  liveTurnCount: number;
  fallbackTurnCount: number;
  providerName: string | null;
  npcProvider: NpcProviderStatus;
}

export interface LastStepRecord {
  id: string;
  fingerprint: string;
  response: RankedNpcSessionSnapshot & { newCommands: Command[] };
}

export interface RankedNpcRecord {
  id: string;
  contractId: string;
  lifeId: string;
  accountId: string;
  seed: string;
  worldVersion: string;
  worldFingerprint: string;
  revision: number;
  tokenHash: string;
  inflight?: string | null;
  state: LifeState;
  hadFallback: boolean;
  liveTurnCount: number;
  fallbackTurnCount: number;
  providerStatus: NpcProviderStatus;
  lastRequest: LastStepRecord | null;
  activeAttestation: NpcSessionAttestation | null;
}

export interface NpcRankedStore {
  saveWorld(fingerprint: string, world: WorldPack): Promise<void>;
  loadWorld(fingerprint: string): Promise<WorldPack | null>;
  insert(record: RankedNpcRecord): Promise<boolean>;
  readById(id: string): Promise<RankedNpcRecord | null>;
  readByLife(contractId: string, lifeId: string): Promise<RankedNpcRecord | null>;
  compareAndSwap(expectedRevision: number, record: RankedNpcRecord): Promise<boolean>;
}

const clone = <T>(value: T): T => structuredClone(value);
const lifeKeyFor = (contractId: string, lifeId: string): string => `${contractId}:${lifeId}`;

export function memoryNpcRankedStore(): NpcRankedStore {
  const records = new Map<string, RankedNpcRecord>();
  const lifeIndex = new Map<string, string>();
  const worlds = new Map<string, WorldPack>();
  return {
    async saveWorld(fingerprint, world) {
      if (!worlds.has(fingerprint)) worlds.set(fingerprint, clone(world));
    },
    async loadWorld(fingerprint) {
      const world = worlds.get(fingerprint);
      return world ? clone(world) : null;
    },
    async insert(record) {
      const key = lifeKeyFor(record.contractId, record.lifeId);
      if (records.has(record.id) || lifeIndex.has(key)) return false;
      records.set(record.id, clone(record));
      lifeIndex.set(key, record.id);
      return true;
    },
    async readById(id) {
      const found = records.get(id);
      return found ? clone(found) : null;
    },
    async readByLife(contractId, lifeId) {
      const id = lifeIndex.get(lifeKeyFor(contractId, lifeId));
      if (!id) return null;
      const found = records.get(id);
      return found ? clone(found) : null;
    },
    async compareAndSwap(expectedRevision, record) {
      const current = records.get(record.id);
      if (!current || current.revision !== expectedRevision) return false;
      records.set(record.id, clone(record));
      return true;
    },
  };
}

export function d1NpcRankedStore(db: ContentDatabase): NpcRankedStore {
  return {
    async saveWorld(fingerprint, world) {
      await db
        .prepare("INSERT OR IGNORE INTO npc_worlds (id, world_json) VALUES (?, ?)")
        .bind(fingerprint, JSON.stringify(world))
        .run();
    },
    async loadWorld(fingerprint) {
      const row = await db
        .prepare("SELECT world_json FROM npc_worlds WHERE id = ?")
        .bind(fingerprint)
        .first<{ world_json: string }>();
      return row ? (JSON.parse(row.world_json) as WorldPack) : null;
    },
    async insert(record) {
      const result = await db
        .prepare(
          "INSERT OR IGNORE INTO npc_ranked_sessions (id, life_key, contract_id, life_id, account_id, seed, world_version, world_fingerprint, revision, token_hash, record_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          record.id,
          lifeKeyFor(record.contractId, record.lifeId),
          record.contractId,
          record.lifeId,
          record.accountId,
          record.seed,
          record.worldVersion,
          record.worldFingerprint,
          record.revision,
          record.tokenHash,
          JSON.stringify(record),
        )
        .run();
      return result.meta?.changes === 1;
    },
    async readById(id) {
      const row = await db
        .prepare("SELECT record_json FROM npc_ranked_sessions WHERE id = ?")
        .bind(id)
        .first<{ record_json: string }>();
      return row ? (JSON.parse(row.record_json) as RankedNpcRecord) : null;
    },
    async readByLife(contractId, lifeId) {
      const row = await db
        .prepare("SELECT record_json FROM npc_ranked_sessions WHERE life_key = ?")
        .bind(lifeKeyFor(contractId, lifeId))
        .first<{ record_json: string }>();
      return row ? (JSON.parse(row.record_json) as RankedNpcRecord) : null;
    },
    async compareAndSwap(expectedRevision, record) {
      const result = await db
        .prepare(
          "UPDATE npc_ranked_sessions SET revision = ?, token_hash = ?, record_json = ? WHERE id = ? AND revision = ?",
        )
        .bind(record.revision, record.tokenHash, JSON.stringify(record), record.id, expectedRevision)
        .run();
      return result.meta?.changes === 1;
    },
  };
}
