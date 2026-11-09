import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
