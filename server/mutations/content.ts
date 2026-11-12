import type { AdminCatalog, PublishedCatalog, PublishedWorld } from "../content.ts";
import { compilePublishedWorld, getBuiltinCatalog, getBuiltinWorld, validateCatalog } from "../content.ts";
import { contentFingerprint } from "../../src/random.ts";
import type { ContentDatabase } from "../db/types.ts";
import { ContentConflict } from "../errors/content-conflict.ts";
import { readCatalogRow, readDraft, readPublished } from "../queries/content.ts";

async function ensureCatalog(db: ContentDatabase): Promise<void> {
  const builtin = getBuiltinCatalog();
  await db.prepare("INSERT OR IGNORE INTO content_catalog (id, revision, draft_json) VALUES (1, 0, ?)")
    .bind(JSON.stringify(builtin.worlds)).run();
  const world = getBuiltinWorld();
  await db.prepare("INSERT OR IGNORE INTO content_world_revisions (id, world_id, world_json, created_at) VALUES (?, ?, ?, ?)")
    .bind(world.revisionId, world.id, JSON.stringify(world), new Date().toISOString()).run();
}

export async function saveDraft(db: ContentDatabase, input: unknown): Promise<AdminCatalog> {
  validateCatalog(input);
  await ensureCatalog(db);
  const saved = await db.prepare("UPDATE content_catalog SET revision = revision + 1, draft_json = ? WHERE id = 1 AND revision = ? RETURNING revision")
    .bind(JSON.stringify(input.worlds), input.revision).first<{ revision: number }>();
  if (!saved) throw new ContentConflict();
  return readDraft(db);
}

export async function publishDraft(db: ContentDatabase, expectedRevision: number): Promise<PublishedCatalog> {
  await ensureCatalog(db);
  const current = await readCatalogRow(db);
  if (!current || current.revision !== expectedRevision) throw new ContentConflict();
  if (current.published_revision === expectedRevision && current.published_id) return readPublished(db);
  const draft = await readDraft(db);
  validateCatalog(draft);
  const worlds: PublishedWorld[] = draft.worlds.filter(world => world.enabled).map(compilePublishedWorld);
  const publicationId = `publication-${draft.revision}-${contentFingerprint(worlds)}`;
  const publishedAt = new Date().toISOString();
  // D1 batch is atomic. Every insert and the pointer switch checks the same draft
  // revision, so a concurrent save cannot publish a stale snapshot.
  const statements = [db.prepare("INSERT OR IGNORE INTO content_publications (id, catalog_revision, worlds_json, created_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM content_catalog WHERE id = 1 AND revision = ?)")
    .bind(publicationId, draft.revision, JSON.stringify(worlds), publishedAt, expectedRevision)];
  for (const world of worlds) statements.push(db.prepare("INSERT OR IGNORE INTO content_world_revisions (id, world_id, world_json, created_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM content_catalog WHERE id = 1 AND revision = ?)")
    .bind(world.revisionId, world.id, JSON.stringify(world), publishedAt, expectedRevision));
  statements.push(db.prepare("UPDATE content_catalog SET published_id = ?, published_revision = ?, published_at = (SELECT created_at FROM content_publications WHERE id = ?) WHERE id = 1 AND revision = ?")
    .bind(publicationId, draft.revision, publicationId, expectedRevision));
  const results = await db.batch(statements);
  if (results.at(-1)?.meta?.changes !== 1) throw new ContentConflict();
  return readPublished(db);
}
