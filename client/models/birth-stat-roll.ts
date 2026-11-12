import type { Effect, LifeState, StatRange, WorldPack } from "../../src/types.ts";
import { merchantSaleValue } from "../../src/demo/market-depth.ts";
import { getNetWorth } from "../../src/economy.ts";
import { getRelevantResources } from "./market.ts";
import { marketQuote } from "../../src/market.ts";
import { TRADE_ITEMS } from "../../src/demo/types.ts";
import type { TradeItem } from "../../src/demo/types.ts";

export interface BirthRollStat {
  id: string;
  label: string;
  value: number;
  range?: StatRange;
  currency?: string;
}

export interface BirthRollResource extends BirthRollStat {
  unitPrice: number;
  marketValue: number;
}

export type BirthRollPhase = "waiting" | "rolling" | "settled";
export const BIRTH_ROLL_DURATION_MS = 3_200;
export const BIRTH_ORIGIN_REVEAL_MS = 420;
export const BIRTH_DIGIT_FRAME_MS = 120;

export interface BirthRollDigit {
  digit: number;
  previous: number;
  direction: "up" | "down";
}

export interface BirthReelLayout {
  integerPlaces: number;
  fractionPlaces: number;
  hasSign: boolean;
  digitCount: number;
}

export interface BirthDigitReel {
  direction: "up" | "down";
  /** Unwrapped digit position: increasing travels up, decreasing travels down. */
  position: number;
  /** The fractional offset within the current adjacent pair of digits. */
  fraction: number;
  /** Previous, current and next rows of the virtual strip, from top to bottom. */
  glyphs: [number, number, number];
  /** Read only when the card settles; never an additional simulation draw. */
  finalDigit: number;
}

function cosmeticHash(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function mod10(value: number): number { return ((value % 10) + 10) % 10; }

function decimalPlaces(value: number): number {
  const [coefficient, exponent = "0"] = String(value).toLowerCase().split("e");
  return Math.max(0, (coefficient.split(".")[1]?.length ?? 0) - Number(exponent));
}

/** Keep the result's integer width throughout the spin, including one reel for zero. */
export function getBirthReelLayout(stat: BirthRollStat): BirthReelLayout {
  const magnitude = Math.abs(stat.value);
  const integer = String(Math.trunc(magnitude));
  const places = Number.isFinite(magnitude) && magnitude >= 1
    ? integer.includes("e") ? Math.floor(Math.log10(magnitude)) + 1 : integer.length
    : 1;
  const integerPlaces = Math.max(1, Math.min(16, places));
  const fractionPlaces = stat.range
    ? Math.min(16 - integerPlaces, Math.max(decimalPlaces(stat.range.min), decimalPlaces(stat.range.max)))
    : 0;
  return { integerPlaces, fractionPlaces, hasSign: !stat.range || stat.range.min < 0, digitCount: integerPlaces + fractionPlaces };
}

/** Unusual imported values may need the existing exact-value formatter instead. */
export function canRepresentBirthReelValue(stat: BirthRollStat, layout = getBirthReelLayout(stat)): boolean {
  const magnitude = Math.abs(stat.value);
  if (!Number.isFinite(magnitude) || (stat.value < 0 && !layout.hasSign)) return false;
  const integer = String(Math.trunc(magnitude));
  return !integer.includes("e") && integer.length <= layout.integerPlaces &&
    Number(magnitude.toFixed(layout.fractionPlaces)) === magnitude;
}

function reelIdentity(stat: BirthRollStat, seed: string, place: number) {
  const key = `${seed}:birth-digit:${stat.id}:${place}`;
  const direction = cosmeticHash(`${key}:direction`) % 2 === 0 ? "up" as const : "down" as const;
  return { key, direction, sign: direction === "up" ? 1 : -1, start: cosmeticHash(`${key}:start`) % 10 };
}

/** The result controls reel count; each place's cosmetic motion is seeded
 * independently. Fixed starts and zero still get moving digits. */
export function getCosmeticBirthDigits(stat: BirthRollStat, seed: string, frame: number): BirthRollDigit[] {
  const count = getBirthReelLayout(stat).digitCount;
  const currentFrame = Number.isFinite(frame) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(frame))) : 0;
  return Array.from({ length: count }, (_, place) => {
    const { direction, sign, start } = reelIdentity(stat, seed, place);
    return {
      digit: mod10(start + sign * (currentFrame % 10)),
      previous: mod10(start + sign * ((currentFrame - 1) % 10)),
      direction,
    };
  });
}

export function getBirthRollTiming(statIndex: number, statCount: number): { startsAt: number; settlesAt: number } {
  const count = Math.max(1, Number.isFinite(statCount) ? Math.floor(statCount) : 1);
  const index = Math.max(0, Math.min(count - 1, Number.isFinite(statIndex) ? Math.floor(statIndex) : 0));
  return {
    startsAt: 0,
    settlesAt: 900 + (index + 1) * (2_300 / count),
  };
}

/**
 * A continuous reel turns in one direction, then slows into the selected value.
 * Only the virtual three-row strip is rendered; full turns never grow the DOM.
 */
export function getBirthDigitReels(stat: BirthRollStat, seed: string, elapsedMs: number, statIndex: number, statCount: number): BirthDigitReel[] {
  const layout = getBirthReelLayout(stat);
  const { startsAt, settlesAt } = getBirthRollTiming(statIndex, statCount);
  const elapsed = Number.isNaN(elapsedMs) ? 0 : elapsedMs;
  const progress = Math.max(0, Math.min(1, (elapsed - startsAt) / (settlesAt - startsAt)));
  const eased = 1 - (1 - progress) ** 3;
  const formatted = canRepresentBirthReelValue(stat, layout)
    ? Math.abs(stat.value).toFixed(layout.fractionPlaces).replace(".", "")
    : String(Math.trunc(Math.abs(stat.value))).replace(/\D/g, "");
  const targets = formatted.padStart(layout.digitCount, "0").slice(-layout.digitCount);
  return Array.from({ length: layout.digitCount }, (_, place) => {
    const { key, direction, sign, start } = reelIdentity(stat, seed, place);
    const finalDigit = Number(targets[place]);
    const turns = 2 + cosmeticHash(`${key}:turns`) % 2;
    const remainder = direction === "up" ? mod10(finalDigit - start) : mod10(start - finalDigit);
    const distance = turns * 10 + remainder;
    const position = progress === 1 ? start + sign * distance : start + sign * distance * eased;
    const base = Math.floor(position);
    return { direction, position, fraction: position - base, glyphs: [mod10(base - 1), mod10(base), mod10(base + 1)], finalDigit };
  });
}

function getBirthEffects(world: WorldPack, life: LifeState): Effect[] {
  const origin = world.origins.find(item => item.id === life.originId);
  const birthEffects: Effect[] = [...origin?.effects ?? []];
  for (const entry of life.journal) {
    if (entry.age !== 0 || entry.type !== "event") continue;
    const event = world.events.find(item => item.id === entry.id);
    if (event?.mode === "automatic") birthEffects.push(...event.effects ?? []);
  }
  return birthEffects;
}

function isUnplayedBirth(life: LifeState): boolean {
  return life.age === 0 && !life.commands.some(command => command.type !== "avatar");
}

const demoResourceLabels: Record<TradeItem, string> = {
  grain: "Grain", flax: "Flax", silver: "Silver", gold: "Gold",
  silk: "Coan silk", linen: "Linen", ox: "Oxen", donkey: "Donkeys",
};

function demoHolding(life: LifeState, item: TradeItem): number {
  const demo = life.demo;
  if (!demo) return 0;
  if (item === "grain" || item === "flax") return demo.household[item];
  if (item === "ox" || item === "donkey") return demo.household.animals[item];
  return demo.goods[item];
}

/** Actual rolled quantities, with the same market prices used by net worth. */
export function getBirthRollResources(world: WorldPack, life: LifeState): BirthRollResource[] {
  if (!world.economy || !life.economy) return [];
  const origin = world.origins.find(item => item.id === life.originId);
  const birthEffects = getBirthEffects(world, life);
  const classic = world.economy.assets.map(asset => {
    const value = life.economy!.assets[asset.id] ?? 0;
    const range = origin?.assetRanges?.[asset.id] ?? asset.initialRange ?? { min: 0, max: 0 };
    const hasDirectEffect = birthEffects.some(effect => effect.type === "asset" && effect.asset === asset.id);
    const unitPrice = marketQuote(world, life, asset.id).sell;
    return { id: `resource:${asset.id}`, label: asset.title, value, unitPrice, marketValue: value * unitPrice,
      ...(isUnplayedBirth(life) && !hasDirectEffect && value >= range.min && value <= range.max ? { range: { ...range } } : {}) };
  });
  const demo = world.demo?.startingResources && life.demo ? TRADE_ITEMS.map(item => {
    const value = demoHolding(life, item);
    const configuration = world.demo!.startingResources!;
    const range = configuration.origins?.[life.originId]?.[item] ?? configuration.defaults[item];
    const marketValue = merchantSaleValue(world.demo!, life.demo!, item, value);
    const unitPrice = value > 0 ? marketValue / value : life.demo!.town.prices[item].buy;
    const changedAtBirth = birthEffects.some(effect => effect.type === "demo" &&
      (effect.effect.kind === "grain" && item === "grain" || effect.effect.kind === "item" && effect.effect.item === item));
    return { id: `demo-resource:${item}`, label: demoResourceLabels[item], value, unitPrice, marketValue,
      ...(isUnplayedBirth(life) && !changedAtBirth && value >= range.min && value <= range.max ? { range: { ...range } } : {}) };
  }) : [];
  return [...demo, ...classic];
}

/** Keep the birth reveal about this household rather than the world's complete
 * catalogue. An actual possession is shown even when unrelated to its origin. */
export function getVisibleBirthRollResources(world: WorldPack, life: LifeState): BirthRollResource[] {
  const visible = new Set(getRelevantResources(world, life).map(item => `resource:${item.asset.id}`));
  return getBirthRollResources(world, life).filter(resource => resource.id.startsWith("demo-resource:") || resource.value > 0 || visible.has(resource.id) || (resource.range?.max ?? 0) > 0);
}

/** A display model only: the simulation has already chosen all these values. */
export function getBirthRollStats(world: WorldPack, life: LifeState): BirthRollStat[] {
  const origin = world.origins.find(item => item.id === life.originId);
  const birthEffects = getBirthEffects(world, life);
  return Object.entries(world.stats).map(([id, definition]) => {
    const value = life.stats[id];
    let range = origin?.statRanges?.[id] ?? definition.initialRange ?? { min: definition.initial, max: definition.initial };
    range = { ...range };
    for (const effect of birthEffects) {
      if (effect.type !== "stat" || effect.stat !== id) continue;
      const clamp = (number: number) => Math.max(definition.min, Math.min(definition.max, number));
      range = { min: clamp(range.min + effect.delta), max: clamp(range.max + effect.delta) };
    }
    // Later actions are not part of a birth draw. Never label their values with
    // an earlier range, including imported records or terminal birth outcomes.
    const isBirthValue = isUnplayedBirth(life) && value >= range.min && value <= range.max;
    if (world.economy?.stat === id && life.economy) {
      const moneyValue = getNetWorth(world, life);
      const resources = getBirthRollResources(world, life);
      const knownResourceRanges = resources.every(resource => resource.range !== undefined);
      const moneyRange = {
        min: Math.round(range.min * world.economy.unitsPerPoint) + resources.reduce((sum, resource) => sum + (resource.range?.min ?? 0) * resource.unitPrice, 0),
        max: Math.round(range.max * world.economy.unitsPerPoint) + resources.reduce((sum, resource) => sum + (resource.range?.max ?? 0) * resource.unitPrice, 0),
      };
      const hasDirectFinance = birthEffects.some(effect => effect.type === "cash" || effect.type === "debt" || effect.type === "asset");
      return { id, label: "Total wealth", value: moneyValue, currency: world.economy.currency.short,
        ...(isUnplayedBirth(life) && knownResourceRanges && !hasDirectFinance && moneyValue >= moneyRange.min && moneyValue <= moneyRange.max ? { range: moneyRange } : {}) };
    }
    return { id, label: definition.label, value, ...(isBirthValue ? { range } : {}) };
  });
}

export function getBirthRollFrame(elapsedMs: number, statCount: number): {
  originRevealed: boolean;
  complete: boolean;
  phases: BirthRollPhase[];
} {
  const elapsed = Math.max(0, elapsedMs);
  const complete = elapsed >= BIRTH_ROLL_DURATION_MS;
  const count = Math.max(0, Math.floor(statCount));
  return {
    originRevealed: elapsed >= BIRTH_ORIGIN_REVEAL_MS,
    complete,
    phases: Array.from({ length: count }, (_, index) => {
      const { startsAt, settlesAt } = getBirthRollTiming(index, count);
      return elapsed >= settlesAt ? "settled" : elapsed >= startsAt ? "rolling" : "waiting";
    }),
  };
}

/** Independent cosmetic samples; this never reads or advances life.rngState. */
export function getCosmeticBirthValue(stat: BirthRollStat, seed: string, frame: number): number {
  const range = stat.range;
  if (!range || !Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max) || range.min >= range.max) return stat.value;
  const key = `${seed}:birth-display:${stat.id}:${Math.max(0, Math.floor(frame))}`;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  const span = BigInt(range.max) - BigInt(range.min) + 1n;
  return Number(BigInt(range.min) + BigInt(hash >>> 0) % span);
}
