import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contentCatalog = sqliteTable("content_catalog", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull(),
  draftJson: text("draft_json").notNull(),
  publishedId: text("published_id"),
  publishedRevision: integer("published_revision"),
  publishedAt: text("published_at"),
});

export const contentPublications = sqliteTable("content_publications", {
  id: text("id").primaryKey(),
  catalogRevision: integer("catalog_revision").notNull(),
  worldsJson: text("worlds_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const contentWorldRevisions = sqliteTable("content_world_revisions", {
  id: text("id").primaryKey(),
  worldId: text("world_id").notNull(),
  worldJson: text("world_json").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Public, content-addressed evidence for minted ranked lives (keyed by the evidence SHA-256). */
export const rankedEvidence = sqliteTable("ranked_evidence", {
  hash: text("hash").primaryKey(),
  evidenceJson: text("evidence_json").notNull(),
  saveJson: text("save_json").notNull(),
  createdAt: text("created_at").notNull(),
});

/** One testnet drip per Privy user; the row is reserved before the transfer and released if it fails. */
export const signinFunding = sqliteTable("signin_funding", {
  privyUserId: text("privy_user_id").primaryKey(),
  accountId: text("account_id").notNull().unique(),
  amount: text("amount").notNull(),
  txHash: text("tx_hash"),
  createdAt: text("created_at").notNull(),
}, table => [index("signin_funding_created_at_idx").on(table.createdAt)]);

/** Online free-play NPC sessions, isolated from ranked evidence and content editing. */
export const npcSessions = sqliteTable("npc_sessions", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  recordJson: text("record_json").notNull(),
});

/** Atomic daily reservations shared by all sessions for an authenticated user. */
export const npcUsage = sqliteTable("npc_usage", {
  id: text("id").primaryKey(),
  used: integer("used").notNull(),
});

/** Immutable world revisions allow old NPC sessions to survive content updates. */
export const npcWorlds = sqliteTable("npc_worlds", {
  id: text("id").primaryKey(),
  worldJson: text("world_json").notNull(),
});


/** Single-use account ownership challenges bound to a ranked NEAR life. */
export const npcAccountChallenges = sqliteTable("npc_account_challenges", {
  nonce: text("nonce").primaryKey(),
  contractId: text("contract_id").notNull(),
  lifeId: text("life_id").notNull(),
  accountId: text("account_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
});

/** Authoritative server sessions bound 1:1 to ranked alexandria-npc-1 lives. */
export const npcRankedSessions = sqliteTable("npc_ranked_sessions", {
  id: text("id").primaryKey(),
  lifeKey: text("life_key").notNull().unique(),
  contractId: text("contract_id").notNull(),
  lifeId: text("life_id").notNull(),
  accountId: text("account_id").notNull(),
  seed: text("seed").notNull(),
  worldVersion: text("world_version").notNull(),
  worldFingerprint: text("world_fingerprint").notNull(),
  revision: integer("revision").notNull(),
  tokenHash: text("token_hash").notNull(),
  recordJson: text("record_json").notNull(),
});
