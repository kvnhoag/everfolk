import type { AdminCatalog, PublishedCatalog, PublishedWorld } from "../content.ts";
import { getBuiltinCatalog, getBuiltinWorld, getArchivedBuiltinWorld, isLegacyFactoryDraft, validateCatalog, worldSummary } from "../content.ts";
import type { CatalogRow, ContentDatabase, PublicationRow } from "../db/types.ts";

export async function readCatalogRow(db: ContentDatabase): Promise<CatalogRow | null> {
  return db.prepare("SELECT revision, draft_json, published_id, published_revision, published_at FROM content_catalog WHERE id = 1").first<CatalogRow>();
}

export async function readDraft(db: ContentDatabase): Promise<AdminCatalog> {
  const current = await readCatalogRow(db);
  if (!current) return getBuiltinCatalog();
  const catalog: AdminCatalog = {
    revision: current.revision, worlds: JSON.parse(current.draft_json),
    publishedRevision: current.published_revision ?? 0, publishedAt: current.published_at,
  };
  if (current.revision === 0 && !current.published_id && isLegacyFactoryDraft(catalog.worlds)) catalog.worlds = getBuiltinCatalog().worlds;
  validateCatalog(catalog);
  return catalog;
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
  const archived = getArchivedBuiltinWorld(id);
  if (archived) return archived;
  const saved = await db.prepare("SELECT world_json FROM content_world_revisions WHERE id = ?").bind(id).first<{ world_json: string }>();
  return saved ? JSON.parse(saved.world_json) as PublishedWorld : null;
}
