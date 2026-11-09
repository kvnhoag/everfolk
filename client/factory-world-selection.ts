import { getArchivedBuiltinWorld, getBuiltinWorld } from "../server/content.ts";
import type { PublishedWorld } from "../server/content.ts";
import { contentFingerprint } from "../src/random.ts";

/** Refresh only an exact shipped factory world when choosing a new birth.
 * Begun lives, edited packs, routes and visual sidecars keep their selection. */
export function selectFactoryWorld(world: PublishedWorld, { hasBegunLife = false, fresh = false }: {
  hasBegunLife?: boolean;
  fresh?: boolean;
} = {}): PublishedWorld {
  if (hasBegunLife && !fresh) return world;
  try {
    const builtin = getBuiltinWorld();
    if (world.id !== builtin.id || world.pack.id !== builtin.pack.id) return world;
    if (world.revisionId === builtin.revisionId) return world;
    const packFingerprint = contentFingerprint(world.pack);
    const archived = getArchivedBuiltinWorld(`pack-${packFingerprint}`);
    if (!archived || archived.id !== world.id || contentFingerprint(archived.pack) !== packFingerprint) return world;
    if (contentFingerprint(archived.routes) !== contentFingerprint(world.routes)) return world;
    if (world.eventVisuals && Object.keys(world.eventVisuals).length > 0) return world;
    // Published factory revisions hash the canonical pack and routes together;
    // bundled revisions hash the pack alone. Verify either exact format.
    const publishedRevision = `pack-${contentFingerprint({ pack: archived.pack, routes: archived.routes,
      ...(world.eventVisuals === undefined ? {} : { eventVisuals: {} }) })}`;
    if (world.revisionId !== archived.revisionId && world.revisionId !== publishedRevision) return world;
    return builtin;
  } catch {
    // An unrecognized or malformed selection is never relabelled as official.
    return world;
  }
}
