export interface MapCamera { x: number; y: number; scale: number }
export interface MapSize { width: number; height: number }
export interface MapPoint { x: number; y: number }

/** Absolute floor; the usable floor is the whole-tree overview for the current viewport (see mapMinZoom). */
export const MAP_MIN_ZOOM = .12;
/** Twice the drawn size: node titles and requirement marks are comfortably legible. */
export const MAP_MAX_ZOOM = 2;
const FIT_PADDING = 24;
export const clampMapZoom = (scale: number, min = MAP_MIN_ZOOM) => Math.max(min, Math.min(MAP_MAX_ZOOM, scale));

function overviewScale(viewport: MapSize, canvas: MapSize): number {
  return clampMapZoom(Math.min((viewport.width - FIT_PADDING) / canvas.width, (viewport.height - FIT_PADDING) / canvas.height));
}

/** Zooming out stops where the whole tree fits the viewport; further out only shows empty paper. */
export function mapMinZoom(viewport: MapSize, canvas: MapSize): number {
  return Math.min(1, overviewScale(viewport, canvas));
}

/** Leave a margin at either end so a drag cannot lose the entire atlas. */
export function constrainMapCamera(camera: MapCamera, viewport: MapSize, canvas: MapSize): MapCamera {
  const scale = clampMapZoom(camera.scale, mapMinZoom(viewport, canvas)), margin = 48;
  const axis = (offset: number, space: number, content: number) => {
    const first = Math.min(margin, space / 4), last = space - content * scale - first;
    return Math.max(Math.min(first, last), Math.min(Math.max(first, last), offset));
  };
  return { scale, x: axis(camera.x, viewport.width, canvas.width), y: axis(camera.y, viewport.height, canvas.height) };
}

export function fitMapCamera(viewport: MapSize, canvas: MapSize): MapCamera {
  const scale = mapMinZoom(viewport, canvas);
  return { scale, x: (viewport.width - canvas.width * scale) / 2, y: (viewport.height - canvas.height * scale) / 2 };
}

/** Preserve the world point beneath the cursor while changing scale. */
export function zoomMapCamera(camera: MapCamera, scale: number, anchor: MapPoint, min = MAP_MIN_ZOOM): MapCamera {
  const next = clampMapZoom(scale, min), ratio = next / camera.scale;
  return { scale: next, x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio };
}

/**
 * A 2D transform on whole device pixels. Fractional offsets and translate3d (which promotes a
 * layer rasterised once) made the map text soft; the browser repaints this crisply at any scale.
 */
export function mapTransform(camera: MapCamera, devicePixelRatio: number): string {
  const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const snap = (value: number) => Math.round(value * ratio) / ratio;
  return `translate(${snap(camera.x)}px, ${snap(camera.y)}px) scale(${camera.scale})`;
}

/** The skill tree opens at the drawn size (100%), where text renders natively, instead of fitting the whole atlas. */
export const READABLE_START_ZOOM = 1;

/** Where the skill tree opens: the deepest learned skill, else the first one the player can learn now. */
export function skillMapStartNode(view: readonly { id: string; state: string }[], depth: ReadonlyMap<string, number>, fallback: string): string {
  const learned = view.filter(node => node.state === "learned").sort((a, b) => (depth.get(b.id) ?? 0) - (depth.get(a.id) ?? 0));
  return learned[0]?.id ?? view.find(node => node.state === "available")?.id ?? fallback;
}
