export interface MapCamera { x: number; y: number; scale: number }
export interface MapSize { width: number; height: number }
export interface MapPoint { x: number; y: number }

export const MAP_MIN_ZOOM = .12;
export const MAP_MAX_ZOOM = 2.4;
export const clampMapZoom = (scale: number) => Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, scale));

/** Leave a margin at either end so a drag cannot lose the entire atlas. */
export function constrainMapCamera(camera: MapCamera, viewport: MapSize, canvas: MapSize): MapCamera {
  const scale = clampMapZoom(camera.scale), margin = 48;
  const axis = (offset: number, space: number, content: number) => {
    const first = Math.min(margin, space / 4), last = space - content * scale - first;
    return Math.max(Math.min(first, last), Math.min(Math.max(first, last), offset));
  };
  return { scale, x: axis(camera.x, viewport.width, canvas.width), y: axis(camera.y, viewport.height, canvas.height) };
}

export function fitMapCamera(viewport: MapSize, canvas: MapSize): MapCamera {
  const scale = clampMapZoom(Math.min((viewport.width - 24) / canvas.width, (viewport.height - 24) / canvas.height));
  return { scale, x: (viewport.width - canvas.width * scale) / 2, y: (viewport.height - canvas.height * scale) / 2 };
}

/** Open at a readable width, leaving later depths below the viewport. */
export function fitMapWidthCamera(viewport: MapSize, canvas: MapSize): MapCamera {
  const scale = clampMapZoom((viewport.width - 24) / canvas.width);
  return { scale, x: (viewport.width - canvas.width * scale) / 2, y: 12 };
}

/** Preserve the world point beneath the cursor while changing scale. */
export function zoomMapCamera(camera: MapCamera, scale: number, anchor: MapPoint): MapCamera {
  const next = clampMapZoom(scale), ratio = next / camera.scale;
  return { scale: next, x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio };
}
