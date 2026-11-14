/** Optional authoring sources live outside Git; normal runtime uses delivered assets. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function artworkRoot(repo) {
  const configured = process.env.EVERFOLK_ARTWORK_DIR?.trim();
  return configured ? resolve(configured) : resolve(repo, "artwork");
}

export function requireArtworkSource(path, description = "Artwork source") {
  if (!existsSync(path)) throw new Error(`${description} is stored outside Git. Restore the private source archive and set EVERFOLK_ARTWORK_DIR to its artwork directory. Missing: ${path}`);
  return path;
}
