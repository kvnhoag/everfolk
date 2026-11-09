import type { AdminCatalog, PublishedCatalog, PublishedWorld } from "./content.ts";
import { compileWorld, getBuiltinCatalog, getBuiltinWorld, validateCatalog, worldSummary } from "./content.ts";
import { contentFingerprint } from "../src/random.ts";

export interface StatementResult { meta?: { changes?: number }; results?: unknown[]; success?: boolean }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<StatementResult>;
}
export interface ContentDatabase {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<StatementResult[]>;
}

interface CatalogRow {
  revision: number;
  draft_json: string;
  published_id: string | null;
  published_revision: number | null;
  published_at: string | null;
}
interface PublicationRow { id: string; catalog_revision: number; worlds_json: string; created_at: string }

export class ContentConflict extends Error {
  constructor() { super("This draft changed in another tab. Reload the catalog before saving or publishing again."); }
}

async function row(db: ContentDatabase): Promise<CatalogRow | null> {
  return db.prepare("SELECT revision, draft_json, published_id, published_revision, published_at FROM content_catalog WHERE id = 1").first<CatalogRow>();
}

async function ensureCatalog(db: ContentDatabase): Promise<void> {
  const builtin = getBuiltinCatalog();
  await db.prepare("INSERT OR IGNORE INTO content_catalog (id, revision, draft_json) VALUES (1, 0, ?)")
    .bind(JSON.stringify(builtin.worlds)).run();
  const world = getBuiltinWorld();
  await db.prepare("INSERT OR IGNORE INTO content_world_revisions (id, world_id, world_json, created_at) VALUES (?, ?, ?, ?)")
    .bind(world.revisionId, world.id, JSON.stringify(world), new Date().toISOString()).run();
}

export async function readDraft(db: ContentDatabase): Promise<AdminCatalog> {
  const current = await row(db);
  if (!current) return getBuiltinCatalog();
  const catalog: AdminCatalog = {
    revision: current.revision, worlds: JSON.parse(current.draft_json),
    publishedRevision: current.published_revision ?? 0, publishedAt: current.published_at,
  };
  validateCatalog(catalog);
  return catalog;
}

export async function saveDraft(db: ContentDatabase, input: unknown): Promise<AdminCatalog> {
  validateCatalog(input);
  await ensureCatalog(db);
  const saved = await db.prepare("UPDATE content_catalog SET revision = revision + 1, draft_json = ? WHERE id = 1 AND revision = ? RETURNING revision")
    .bind(JSON.stringify(input.worlds), input.revision).first<{ revision: number }>();
  if (!saved) throw new ContentConflict();
  return readDraft(db);
}

async function publication(db: ContentDatabase): Promise<PublicationRow | null> {
  return db.prepare("SELECT p.id, p.catalog_revision, p.worlds_json, p.created_at FROM content_publications p JOIN content_catalog c ON c.published_id = p.id WHERE c.id = 1").first<PublicationRow>();
}

export async function readPublished(db: ContentDatabase): Promise<PublishedCatalog> {
  const published = await publication(db);
  if (!published) return { revision: 0, publicationId: "builtin", publishedAt: null, worlds: [worldSummary(getBuiltinWorld())] };
  const worlds: PublishedWorld[] = JSON.parse(published.worlds_json);
  return { revision: published.catalog_revision, publicationId: published.id, publishedAt: published.created_at, worlds: worlds.map(worldSummary) };
}

export async function readPublishedWorld(db: ContentDatabase, id: string): Promise<PublishedWorld | null> {
  const published = await publication(db);
  if (!published) {
    const builtin = getBuiltinWorld();
    return id === builtin.id ? builtin : null;
  }
  return (JSON.parse(published.worlds_json) as PublishedWorld[]).find(world => world.id === id) ?? null;
}

export async function readRevision(db: ContentDatabase, id: string): Promise<PublishedWorld | null> {
  const builtin = getBuiltinWorld();
  if (id === builtin.revisionId) return builtin;
  const saved = await db.prepare("SELECT world_json FROM content_world_revisions WHERE id = ?").bind(id).first<{ world_json: string }>();
  return saved ? JSON.parse(saved.world_json) as PublishedWorld : null;
}

export async function publishDraft(db: ContentDatabase, expectedRevision: number): Promise<PublishedCatalog> {
  await ensureCatalog(db);
  const current = await row(db);
  if (!current || current.revision !== expectedRevision) throw new ContentConflict();
  if (current.published_revision === expectedRevision && current.published_id) return readPublished(db);
  const draft: AdminCatalog = { revision: current.revision, worlds: JSON.parse(current.draft_json) };
  validateCatalog(draft);
  const worlds: PublishedWorld[] = draft.worlds.filter(world => world.enabled).map(world => {
    const pack = compileWorld(world);
    return { id: world.id, revisionId: `pack-${contentFingerprint({ pack, routes: world.routes })}`, pack, routes: structuredClone(world.routes) };
  });
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
