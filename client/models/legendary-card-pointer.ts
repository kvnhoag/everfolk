export interface CardPointerBounds { left: number; top: number; width: number; height: number }

/** Bounded tilt and reflection position, measured against a fixed card wrapper. */
export function legendaryCardPointer(clientX: number, clientY: number, bounds: CardPointerBounds) {
  if (![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite)
    || bounds.width <= 0 || bounds.height <= 0) return null;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const x = clamp((clientX - bounds.left) / bounds.width);
  const y = clamp((clientY - bounds.top) / bounds.height);
  return {
    lightX: x * 100, lightY: y * 100,
    rotateX: (0.5 - y) * 7, rotateY: (x - 0.5) * 9,
    sweep: (x - 0.5) * 36, angle: 115 + (x - 0.5) * 20,
  };
}
