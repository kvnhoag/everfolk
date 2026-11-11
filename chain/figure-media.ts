import type { FigureId } from "./ids.ts";

/**
 * Figure art lives in public/assets/figures/, exported from the history-live
 * character creator: `<id>.png` is the 480×640 collectible card used as NFT
 * media, `<id>-front.png` the 192×288 transparent front sprite.
 */
export const FIGURE_MEDIA_DIR = "/assets/figures";

/** Set before `pnpm ranked:world` to publish absolute media URLs, e.g. https://everfolk.example. */
export const FIGURE_MEDIA_BASE_ENV = "FIGURE_MEDIA_BASE_URL";

export function figureMediaPath(id: FigureId): string {
  return `${FIGURE_MEDIA_DIR}/${id}.png`;
}

export function figureFrontPath(id: FigureId): string {
  return `${FIGURE_MEDIA_DIR}/${id}-front.png`;
}

/** An empty base keeps the site-relative path; otherwise an http(s) origin, optionally with a path prefix. */
export function figureMediaBase(baseUrl: string | undefined): string {
  const base = (baseUrl ?? "").trim();
  if (!base) return "";
  let url: URL;
  try { url = new URL(base); } catch { throw new Error(`${FIGURE_MEDIA_BASE_ENV} must be an absolute http(s) URL, got "${base}".`); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${FIGURE_MEDIA_BASE_ENV} must use http or https.`);
  if (url.search || url.hash || url.username || url.password) throw new Error(`${FIGURE_MEDIA_BASE_ENV} must not carry a query, fragment or credentials.`);
  return `${url.origin}${url.pathname}`.replace(/\/+$/u, "");
}

export function figureMediaUrl(id: FigureId, baseUrl?: string): string {
  return `${figureMediaBase(baseUrl)}${figureMediaPath(id)}`;
}

