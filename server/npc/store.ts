import type { WorldPack } from "../../src/types.ts";
import type { ContentDatabase } from "../db/types.ts";
import type { NpcSessionState, NpcDecision } from "../../src/npc/types.ts";
export interface SessionRecord {
  id: string;
  ownerHash: string;
  ownerId: string | null;
  revision: number;
  worldFingerprint: string;
  state: NpcSessionState;
  leases: Record<string, { hash: string; expires: number }>;
  proposals: Record<string, { age: number; decision: NpcDecision }>;
  receipts: Record<string, { request: string; revision: number }>;
  llmAttempts: number;
  turnLock: { key: string; until: number } | null;
}
export interface NpcSessionStore {
  create(record: SessionRecord): Promise<boolean>;
  read(id: string): Promise<SessionRecord | null>;
  compareAndSwap(expected: number, record: SessionRecord): Promise<boolean>;
  reserveUsage(key: string, amount: number, limit: number): Promise<boolean>;
  saveWorld(id: string, world: WorldPack): Promise<void>;
  readWorld(id: string): Promise<WorldPack | null>;
}
/** Development/test store; production composition requires durable D1 storage. */
export function memoryNpcStore(): NpcSessionStore {
  const rows = new Map<string, SessionRecord>(),
    usage = new Map<string, number>(),
    worlds = new Map<string, WorldPack>();
  return {
    async saveWorld(id, world) {
      if (!worlds.has(id)) worlds.set(id, structuredClone(world));
    },
    async readWorld(id) {
      return structuredClone(worlds.get(id) ?? null);
    },
    async create(r) {
      if (rows.has(r.id)) return false;
      rows.set(r.id, structuredClone(r));
      return true;
    },
    async read(id) {
      return structuredClone(rows.get(id) ?? null);
    },
    async compareAndSwap(expected, r) {
      if (rows.get(r.id)?.revision !== expected) return false;
      rows.set(r.id, structuredClone(r));
      return true;
    },
    async reserveUsage(key, amount, limit) {
      const used = usage.get(key) ?? 0;
      if (used + amount > limit) return false;
      usage.set(key, used + amount);
      return true;
    },
  };
}
export function d1NpcStore(db: ContentDatabase): NpcSessionStore {
  return {
    async saveWorld(id, world) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO npc_worlds (id, world_json) VALUES (?, ?)",
        )
        .bind(id, JSON.stringify(world))
        .run();
    },
    async readWorld(id) {
      const row = await db
        .prepare("SELECT world_json FROM npc_worlds WHERE id = ?")
        .bind(id)
        .first<{ world_json: string }>();
      return row ? JSON.parse(row.world_json) : null;
    },
    async create(r) {
      const result = await db
        .prepare(
          "INSERT OR IGNORE INTO npc_sessions (id, revision, record_json) VALUES (?, ?, ?)",
        )
        .bind(r.id, r.revision, JSON.stringify(r))
        .run();
      return result.meta?.changes === 1;
    },
    async read(id) {
      const row = await db
        .prepare("SELECT record_json FROM npc_sessions WHERE id = ?")
        .bind(id)
        .first<{ record_json: string }>();
      return row ? JSON.parse(row.record_json) : null;
    },
    async reserveUsage(key, amount, limit) {
      const result = await db
        .prepare(
          "INSERT INTO npc_usage (id, used) SELECT ?, ? WHERE ? <= ? ON CONFLICT (id) DO UPDATE SET used = npc_usage.used + excluded.used WHERE npc_usage.used + excluded.used <= ?",
        )
        .bind(key, amount, amount, limit, limit)
        .run();
      return result.meta?.changes === 1;
    },
    async compareAndSwap(expected, r) {
      const result = await db
        .prepare(
          "UPDATE npc_sessions SET revision = ?, record_json = ? WHERE id = ? AND revision = ?",
        )
        .bind(r.revision, JSON.stringify(r), r.id, expected)
        .run();
      return result.meta?.changes === 1;
    },
  };
}
