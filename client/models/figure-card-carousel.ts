/** Navigation helpers have no relationship to earned rarity or ownership. */
export type VariantStep = -1 | 0 | 1;
export const CARD_RARITY_ORDER = Object.freeze(["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const);
export type CardRarity = typeof CARD_RARITY_ORDER[number];
const variantCount = (count: number) => Number.isSafeInteger(count) && count > 0 ? count : 1;
const integer = (value: number) => Number.isFinite(value) ? Math.trunc(value) : 0;
const boundedIndex = (index: number, count: number) => Math.max(0, Math.min(count - 1, integer(index)));

/** Sort available variants without adding rarities or mutating their authored list. */
export function orderedVariantRanks<T extends CardRarity>(ranks: readonly T[]): T[] {
  return ranks.slice().sort((left, right) => CARD_RARITY_ORDER.indexOf(left) - CARD_RARITY_ORDER.indexOf(right));
}

/** Move through rarity order; the lowest and highest variants are hard boundaries. */
export function stepVariantIndex(index: number, count: number, step: VariantStep): number {
  const size = variantCount(count);
  return boundedIndex(boundedIndex(index, size) + step, size);
}

/** Signed positions keep lower rarities left of the selected card and higher ones right. */
export function variantStackSlot(index: number, selectedIndex: number, count: number): number {
  const size = variantCount(count);
  return boundedIndex(index, size) - boundedIndex(selectedIndex, size);
}

export interface WheelGestureState {
  accumulated: number;
  lastInputAt: number | null;
  lastStepAt: number | null;
}
export interface VariantWheelInput {
  deltaX: number;
  deltaY: number;
  /** DOM_DELTA_PIXEL = 0, DOM_DELTA_LINE = 1, DOM_DELTA_PAGE = 2. */
  deltaMode: number;
  timeStamp: number;
  pageHeight?: number;
}
export const VARIANT_WHEEL_THRESHOLD = 48;
export const VARIANT_WHEEL_COOLDOWN_MS = 420;
const WHEEL_GESTURE_GAP_MS = 240;
export function initialWheelGesture(): WheelGestureState {
  return { accumulated: 0, lastInputAt: null, lastStepAt: null };
}

/**
 * Accumulate trackpad deltas; one gesture cannot race through multiple cards.
 * Positive movement advances. Attach a non-passive wheel listener to the card
 * stage only, so the detached details panel retains ordinary document scrolling.
 */
export function reduceVariantWheel(state: WheelGestureState, input: VariantWheelInput, count: number): { state: WheelGestureState; step: VariantStep } {
  if (variantCount(count) < 2) return { state: initialWheelGesture(), step: 0 };
  const now = input.timeStamp;
  if (!Number.isFinite(now) || now < 0) return { state, step: 0 };
  const previous = state.lastInputAt !== null && now < state.lastInputAt ? initialWheelGesture() : state;
  const x = Number.isFinite(input.deltaX) ? input.deltaX : 0;
  const y = Number.isFinite(input.deltaY) ? input.deltaY : 0;
  const dominant = Math.abs(x) > Math.abs(y) ? x : y;
  const page = input.pageHeight && Number.isFinite(input.pageHeight) && input.pageHeight > 0 ? input.pageHeight : 640;
  const delta = dominant * (input.deltaMode === 1 ? 16 : input.deltaMode === 2 ? page : 1);
  if (delta === 0) return { state: previous, step: 0 };
  if (previous.lastStepAt !== null && now - previous.lastStepAt < VARIANT_WHEEL_COOLDOWN_MS) {
    return { state: { accumulated: 0, lastInputAt: now, lastStepAt: previous.lastStepAt }, step: 0 };
  }
  const paused = previous.lastInputAt === null || now - previous.lastInputAt > WHEEL_GESTURE_GAP_MS;
  const reversed = previous.accumulated !== 0 && Math.sign(previous.accumulated) !== Math.sign(delta);
  const accumulated = (paused || reversed ? 0 : previous.accumulated) + delta;
  if (Math.abs(accumulated) < VARIANT_WHEEL_THRESHOLD) {
    return { state: { accumulated, lastInputAt: now, lastStepAt: previous.lastStepAt }, step: 0 };
  }
  return { state: { accumulated: 0, lastInputAt: now, lastStepAt: now }, step: accumulated > 0 ? 1 : -1 };
}

/** Leftward swipes advance; predominantly vertical touches retain normal scrolling. */
export function swipeVariantStep(deltaX: number, deltaY: number): VariantStep {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return 0;
  return deltaX < 0 ? 1 : -1;
}
