/** Lead (+ tracks for their own config sections) — validation of `world.demo`, demo effects and conditions. */
import { ANIMAL_OR_GOOD, CONDITION_FAMILIES } from "./validate-ids.ts";
import { OFFERS, TRADE_ITEMS, WORKS } from "./types.ts";

type Fail = (path: string, message: string) => never;
type Data = Record<string, unknown>;

const LEVELS: Record<string, readonly string[]> = { flood: ["low", "normal", "high"], army: ["quiet", "recruiting", "war"], road: ["safe", "uneasy", "dangerous"] };
const OPS = ["gte", "lte", "gt", "lt", "eq"];

function record(value: unknown, path: string, fail: Fail, fields: readonly string[], required: readonly string[] = fields): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(path, "expected an object");
  const data = value as Data;
  for (const key of Object.keys(data)) if (!fields.includes(key)) fail(`${path}.${key}`, "unsupported field");
  for (const key of required) if (!Object.hasOwn(data, key)) fail(`${path}.${key}`, "required");
  return data;
}

function whole(value: unknown, path: string, fail: Fail, min = -1_000_000_000, max = 1_000_000_000): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail(path, `expected a whole number in ${min}..${max}`);
  return value as number;
}

function oneOf(value: unknown, allowed: readonly string[], path: string, fail: Fail): string {
  if (typeof value !== "string" || !allowed.includes(value)) fail(path, `expected one of ${allowed.join(", ")}`);
  return value as string;
}

/** Shape check of the config. Tracks extend the checks for their own section. */
export function validateDemoDefinition(value: unknown, fail: Fail, ids: { jobs: Set<string>; activities: Set<string>; skills: Set<string>; achievements: Set<string>; origins?: Set<string> }): void {
  const sections = ["timeline", "household", "market", "service", "works", "agents", "availability"];
  const def = record(value, "world.demo", fail, [...sections, "startingResources", "resourceScaleDivisor"], sections);
  if (Object.hasOwn(def, "resourceScaleDivisor")) whole(def.resourceScaleDivisor, "world.demo.resourceScaleDivisor", fail, 1, 100);
  for (const section of ["timeline", "household", "market", "service", "works", "agents"]) record(def[section], `world.demo.${section}`, fail, Object.keys(def[section] as Data ?? {}));
  const household = def.household as Data;
  if (Object.hasOwn(household, "buySeedWhenShort") && typeof household.buySeedWhenShort !== "boolean") fail("world.demo.household.buySeedWhenShort", "expected a boolean");
  if (Object.hasOwn(household, "rentOnFlax") && typeof household.rentOnFlax !== "boolean") fail("world.demo.household.rentOnFlax", "expected a boolean");
  if (Object.hasOwn(household, "leaseUnworkedBps")) whole(household.leaseUnworkedBps, "world.demo.household.leaseUnworkedBps", fail, 0, 10_000);
  const availability = record(def.availability, "world.demo.availability", fail,
    ["playableJobs", "unavailableJobs", "unavailableActivities", "unavailableSkills", "unavailableAccomplishments", "futurePaths"]);
  const lists: [string, Set<string>][] = [["playableJobs", ids.jobs], ["unavailableJobs", ids.jobs], ["unavailableActivities", ids.activities], ["unavailableSkills", ids.skills], ["unavailableAccomplishments", ids.achievements]];
  for (const [key, known] of lists) {
    const list = availability[key];
    if (!Array.isArray(list)) fail(`world.demo.availability.${key}`, "expected an array");
    (list as unknown[]).forEach((id, i) => { if (typeof id !== "string" || !known.has(id)) fail(`world.demo.availability.${key}[${i}]`, "unknown id"); });
  }
  const playable = new Set(availability.playableJobs as string[]);
  (availability.unavailableJobs as string[]).forEach((id, i) => { if (playable.has(id)) fail(`world.demo.availability.unavailableJobs[${i}]`, "a job cannot be playable and unavailable"); });
  if (Object.hasOwn(def, "startingResources")) {
    const at = "world.demo.startingResources", limit = 1_000_000_000_000;
    const config = record(def.startingResources, at, fail, ["defaults", "origins", "storeCapacityByOrigin"], ["defaults"]);
    const rangeMap = (value: unknown, path: string, required: readonly string[]) => {
      const ranges = record(value, path, fail, TRADE_ITEMS, required);
      for (const [item, value] of Object.entries(ranges)) {
        const range = record(value, `${path}.${item}`, fail, ["min", "max"]);
        const min = whole(range.min, `${path}.${item}.min`, fail, 0, limit);
        const max = whole(range.max, `${path}.${item}.max`, fail, 0, limit);
        if (min > max) fail(`${path}.${item}`, "minimum must not exceed maximum");
      }
      return ranges;
    };
    const defaults = rangeMap(config.defaults, `${at}.defaults`, TRADE_ITEMS);
    const market = def.market as Data;
    const prices = record(market.basePrice, "world.demo.market.basePrice", fail, TRADE_ITEMS);
    for (const item of TRADE_ITEMS) whole(prices[item], `world.demo.market.basePrice.${item}`, fail, 1, limit);
    const safeValue = (ranges: Data, path: string) => {
      const maximum = TRADE_ITEMS.reduce((sum, item) => sum + (((ranges[item] ?? defaults[item]) as Data).max as number) * (prices[item] as number), 0);
      if (!Number.isSafeInteger(maximum) || maximum > limit) fail(path, "combined starting resource market value must stay within 1000000000000");
    };
    safeValue(defaults, `${at}.defaults`);
    if (Object.hasOwn(config, "storeCapacityByOrigin")) {
      const storagePath = `${at}.storeCapacityByOrigin`;
      const capacities = record(config.storeCapacityByOrigin, storagePath, fail, Object.keys(config.storeCapacityByOrigin as Data ?? {}));
      for (const [origin, capacity] of Object.entries(capacities)) {
        if (ids.origins && !ids.origins.has(origin)) fail(`${storagePath}.${origin}`, "unknown origin");
        whole(capacity, `${storagePath}.${origin}`, fail, 0, limit);
      }
    }
    if (Object.hasOwn(config, "origins")) {
      const origins = record(config.origins, `${at}.origins`, fail, Object.keys(config.origins as Data ?? {}));
      for (const [origin, value] of Object.entries(origins)) {
        if (ids.origins && !ids.origins.has(origin)) fail(`${at}.origins.${origin}`, "unknown origin");
        const ranges = rangeMap(value, `${at}.origins.${origin}`, []);
        safeValue(ranges, `${at}.origins.${origin}`);
      }
    }
  }
}

/** `allowGrainGain`: only influence entries (NFT deeds) may add grain to the store. */
export function validateDemoEffect(value: Data, path: string, fail: Fail, allowGrainGain: boolean): void {
  const effect = record(value.effect, `${path}.effect`, fail, Object.keys(value.effect as Data ?? {}), ["kind"]);
  const at = `${path}.effect`;
  switch (effect.kind) {
    case "grain": {
      record(effect, at, fail, ["kind", "delta", "cause"]);
      const delta = whole(effect.delta, `${at}.delta`, fail);
      if (delta > 0 && !allowGrainGain) fail(`${at}.delta`, "only harvests and NFT deeds create grain");
      if (typeof effect.cause !== "string" || !effect.cause) fail(`${at}.cause`, "expected a cause");
      break;
    }
    case "item":
      record(effect, at, fail, ["kind", "item", "delta", "cause"]);
      oneOf(effect.item, [...ANIMAL_OR_GOOD, "flax"], `${at}.item`, fail);
      whole(effect.delta, `${at}.delta`, fail);
      if (typeof effect.cause !== "string" || !effect.cause) fail(`${at}.cause`, "expected a cause");
      break;
    case "reputation": record(effect, at, fail, ["kind", "delta"]); whole(effect.delta, `${at}.delta`, fail, -100, 100); break;
    case "work": record(effect, at, fail, ["kind", "work", "progress"]); oneOf(effect.work, WORKS, `${at}.work`, fail); whole(effect.progress, `${at}.progress`, fail, 1, 100); break;
    case "share-grain": record(effect, at, fail, ["kind", "quantity"]); whole(effect.quantity, `${at}.quantity`, fail, 1); break;
    case "grain-to":
      record(effect, at, fail, ["kind", "to", "quantity", "cause"]);
      oneOf(effect.to, ["crown", "temple"], `${at}.to`, fail); whole(effect.quantity, `${at}.quantity`, fail, 1);
      if (typeof effect.cause !== "string" || !effect.cause) fail(`${at}.cause`, "expected a cause");
      break;
    case "plot":
      record(effect, at, fail, ["kind", "delta", "cause"]);
      whole(effect.delta, `${at}.delta`, fail, -10, 10);
      if (typeof effect.cause !== "string" || !effect.cause) fail(`${at}.cause`, "expected a cause");
      break;
    case "harvest-bonus": record(effect, at, fail, ["kind", "bps"]); whole(effect.bps, `${at}.bps`, fail, 0, 10_000); break;
    case "convoy":
      record(effect, at, fail, ["kind", "action", "lossBps", "riskCutBps"], ["kind", "action"]);
      oneOf(effect.action, ["provision", "companion", "depart", "withdraw", "resolve"], `${at}.action`, fail);
      if (Object.hasOwn(effect, "lossBps")) whole(effect.lossBps, `${at}.lossBps`, fail, 0, 10_000);
      if (Object.hasOwn(effect, "riskCutBps")) whole(effect.riskCutBps, `${at}.riskCutBps`, fail, 0, 10_000);
      break;
    case "offer": record(effect, at, fail, ["kind", "action"]); oneOf(effect.action, ["accept", "decline"], `${at}.action`, fail); break;
    default: fail(`${at}.kind`, "unknown demo effect");
  }
}

export function validateDemoCondition(value: Data, path: string, fail: Fail): void {
  const condition = record(value.condition, `${path}.condition`, fail, Object.keys(value.condition as Data ?? {}), ["kind"]);
  const at = `${path}.condition`;
  switch (condition.kind) {
    case "year": {
      record(condition, at, fail, ["kind", "family", "level", "fresh"], ["kind", "family", "level"]);
      const family = oneOf(condition.family, CONDITION_FAMILIES, `${at}.family`, fail);
      oneOf(condition.level, LEVELS[family], `${at}.level`, fail);
      if (Object.hasOwn(condition, "fresh") && typeof condition.fresh !== "boolean") fail(`${at}.fresh`, "expected a boolean");
      break;
    }
    case "item": record(condition, at, fail, ["kind", "item", "op", "value"]); oneOf(condition.item, [...ANIMAL_OR_GOOD, "grain", "flax"], `${at}.item`, fail); oneOf(condition.op, OPS, `${at}.op`, fail); whole(condition.value, `${at}.value`, fail, 0); break;
    case "reputation": record(condition, at, fail, ["kind", "op", "value"]); oneOf(condition.op, OPS.slice(0, 4), `${at}.op`, fail); whole(condition.value, `${at}.value`, fail, 0, 100); break;
    case "work": record(condition, at, fail, ["kind", "work", "built"]); oneOf(condition.work, WORKS, `${at}.work`, fail); if (typeof condition.built !== "boolean") fail(`${at}.built`, "expected a boolean"); break;
    case "convoy": record(condition, at, fail, ["kind", "stage"]); oneOf(condition.stage, ["muster", "road", "none"], `${at}.stage`, fail); break;
    case "offer": record(condition, at, fail, ["kind", "offer"]); oneOf(condition.offer, OFFERS, `${at}.offer`, fail); break;
    case "plots": record(condition, at, fail, ["kind", "op", "value"]); oneOf(condition.op, OPS, `${at}.op`, fail); whole(condition.value, `${at}.value`, fail, 0, 100); break;
    case "hungry": record(condition, at, fail, ["kind"]); break;
    case "head-of-plot": record(condition, at, fail, ["kind", "value"]); if (typeof condition.value !== "boolean") fail(`${at}.value`, "expected a boolean"); break;
    default: fail(`${at}.kind`, "unknown demo condition");
  }
}
void TRADE_ITEMS;
