import type { CapabilityDefinition } from "./capabilities/types.ts";
import { validateCapabilities } from "./capabilities/validate.ts";
import type { VocationDefinition } from "./vocations/types.ts";
import { validateVocations } from "./vocations/validate.ts";
import { validateLifeStagesDefinition, validateStagedEvent } from "./life-stages/validate.ts";
import type { LifeStageValidationTools } from "./life-stages/validate.ts";
import { validateEventFields, validatePathsCondition, validatePathsDefinition, validatePathsEffect } from "./paths/validate.ts";
import { validateDemoCondition, validateDemoDefinition, validateDemoEffect } from "./demo/validate.ts";
import type { WorldPack } from "./types.ts";

type DataObject = Record<string, unknown>;
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ID = /^[a-z][a-z0-9-]*$/;
const INFLUENCE_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;
const OPERATORS = new Set(["eq", "ne", "gt", "gte", "lt", "lte"]);
const MAX_NODES = 100_000;

/** Reject malformed or executable pack data before it reaches the simulation. */
export function validateWorld(input: unknown): asserts input is WorldPack {
  let nodes = 0;
  function fail(path: string, message: string): never {
    throw new Error(`Invalid world at ${path}: ${message}`);
  }
  const budget = (path: string): void => {
    if (++nodes > MAX_NODES) fail(path, `pack exceeds ${MAX_NODES} validation nodes`);
  };
  const object = (
    value: unknown,
    path: string,
    fields?: readonly string[],
    required: readonly string[] = fields ?? [],
  ): DataObject => {
    budget(path);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      fail(path, "expected a plain JSON object");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail(path, "expected a plain JSON object");
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") fail(path, "symbol keys are not JSON data");
      if (BAD_KEYS.has(key)) fail(`${path}.${key}`, "reserved key");
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!("value" in descriptor) || !descriptor.enumerable) {
        fail(`${path}.${key}`, "expected an enumerable data property");
      }
      if (fields && !fields.includes(key)) fail(`${path}.${key}`, "unknown field");
    }
    for (const key of required) {
      if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "required field is missing");
    }
    return value as DataObject;
  };
  const array = (value: unknown, path: string, min = 0, max = 5_000): unknown[] => {
    budget(path);
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      fail(path, "expected a JSON array");
    }
    if (value.length < min || value.length > max) fail(path, `expected ${min}..${max} entries`);
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1) fail(path, "sparse arrays and extra array properties are not JSON data");
    for (let i = 0; i < value.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        fail(`${path}[${i}]`, "expected an enumerable data entry");
      }
    }
    return value;
  };
  const string = (value: unknown, path: string, max = 20_000): string => {
    if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
      fail(path, `expected a nonempty string of at most ${max} characters`);
    }
    return value;
  };
  const id = (value: unknown, path: string): string => {
    const result = string(value, path, 100);
    if (!ID.test(result) || BAD_KEYS.has(result)) fail(path, "expected a non-reserved lowercase ID matching /^[a-z][a-z0-9-]*$/");
    return result;
  };
  const number = (value: unknown, path: string): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "expected a finite number");
    return value;
  };
  const integer = (value: unknown, path: string, min: number, max: number): number => {
    const result = number(value, path);
    if (!Number.isSafeInteger(result) || result < min || result > max) {
      fail(path, `expected a safe integer in ${min}..${max}`);
    }
    return result;
  };
  const bool = (value: unknown, path: string): void => {
    if (typeof value !== "boolean") fail(path, "expected a boolean");
  };
  const weight = (value: unknown, path: string): number => {
    const result = number(value, path);
    if (result <= 0 || result > Number.MAX_SAFE_INTEGER) fail(path, "expected a positive weight no greater than Number.MAX_SAFE_INTEGER");
    return result;
  };
  const aggregate = (values: readonly number[], path: string): void => {
    let total = 0;
    for (const value of values) {
      total += value;
      if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) {
        fail(path, "combined weights exceed Number.MAX_SAFE_INTEGER");
      }
    }
  };
  const unique = (entries: unknown[], path: string): Set<string> => {
    const ids = new Set<string>();
    entries.forEach((entry, i) => {
      const item = object(entry, `${path}[${i}]`, undefined, ["id"]);
      const key = id(item.id, `${path}[${i}].id`);
      if (ids.has(key)) fail(`${path}[${i}].id`, `duplicate ID '${key}'`);
      ids.add(key);
    });
    return ids;
  };
  const reference = (value: unknown, path: string, known: Set<string>, kind: string): void => {
    const key = id(value, path);
    if (!known.has(key)) fail(path, `unknown ${kind} '${key}'`);
  };
  const year = (value: unknown, path: string): number => {
    const result = integer(value, path, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    if (result === 0) fail(path, "historical years have no year zero");
    return result;
  };

  const worldFields = [
    "schemaVersion", "id", "version", "title", "description", "startYear", "maxAge",
    "stats", "flags", "origins", "yearlyEffects", "events", "endings", "defaultEnding",
  ];
  const world = object(input, "world", [...worldFields, "sources", "yearlyRules", "mortality", "eventPacing", "character", "economy", "health", "relationships", "knowledge", "legacy", "influences", "demo", "vocations", "capabilities", "lifeStages", "paths"], worldFields);
  let demoGrainGain = false;
  const requireDemo = (path: string): void => { if (!Object.hasOwn(world, "demo")) fail(path, "requires a demo world"); };
  if (world.schemaVersion !== 1) fail("world.schemaVersion", "only schema version 1 is supported");
  id(world.id, "world.id");
  string(world.version, "world.version", 100);
  string(world.title, "world.title", 300);
  string(world.description, "world.description");
  const startYear = year(world.startYear, "world.startYear");
  const maxAge = integer(world.maxAge, "world.maxAge", 1, 10_000);
  if (Object.hasOwn(world, "eventPacing")) {
    const pacing = object(world.eventPacing, "world.eventPacing", ["minChoiceGapYears", "maxChoiceGapYears", "variety", "rareEvents"], ["minChoiceGapYears", "maxChoiceGapYears"]);
    const minGap = integer(pacing.minChoiceGapYears, "world.eventPacing.minChoiceGapYears", 1, 10_000);
    integer(pacing.maxChoiceGapYears, "world.eventPacing.maxChoiceGapYears", minGap, 10_000);
    if (Object.hasOwn(pacing, "rareEvents")) {
      const rare = object(pacing.rareEvents, "world.eventPacing.rareEvents", ["annualChance", "cooldownYears"]);
      const chance = number(rare.annualChance, "world.eventPacing.rareEvents.annualChance");
      if (chance < 0 || chance > 1) fail("world.eventPacing.rareEvents.annualChance", "expected a probability in 0..1");
      integer(rare.cooldownYears, "world.eventPacing.rareEvents.cooldownYears", 1, maxAge);
    }
    if (Object.hasOwn(pacing, "variety")) {
      const variety = object(pacing.variety, "world.eventPacing.variety", ["recentWindow", "recentWeight", "repeatWeight"]);
      integer(variety.recentWindow, "world.eventPacing.variety.recentWindow", 1, 1_000);
      for (const field of ["recentWeight", "repeatWeight"]) {
        const multiplier = number(variety[field], `world.eventPacing.variety.${field}`);
        if (multiplier < 0.001 || multiplier > 1) fail(`world.eventPacing.variety.${field}`, "expected a multiplier in 0.001..1");
      }
    }
  }
  const lastAstronomicalYear = (startYear < 0 ? startYear + 1 : startYear) + maxAge;
  const lastYear = lastAstronomicalYear <= 0 ? lastAstronomicalYear - 1 : lastAstronomicalYear;
  if (!Number.isSafeInteger(lastAstronomicalYear) || !Number.isSafeInteger(lastYear)) {
    fail("world.startYear", "calendar range through maxAge must remain a safe integer");
  }

  const sources = Object.hasOwn(world, "sources") ? array(world.sources, "world.sources", 0, 128) : [];
  const sourceIds = unique(sources, "world.sources");
  sources.forEach((entry, i) => {
    const path = `world.sources[${i}]`;
    const source = object(entry, path, ["id", "title", "url", "publisher", "kind", "period", "geography", "summary", "limitations", "accessed"]);
    for (const field of ["title", "publisher", "period", "geography", "summary", "limitations"]) string(source[field], `${path}.${field}`);
    if (!["primary", "museum", "scholarship"].includes(source.kind as string)) fail(`${path}.kind`, "unknown source kind");
    const url = string(source.url, `${path}.url`, 4_000);
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) fail(`${path}.url`, "expected an HTTPS source URL without credentials");
    } catch { fail(`${path}.url`, "expected an HTTPS source URL without credentials"); }
    const accessed = string(source.accessed, `${path}.accessed`, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(accessed)) fail(`${path}.accessed`, "expected a YYYY-MM-DD access date");
    const [accessYear, month, day] = accessed.split("-").map(Number);
    const leap = accessYear % 4 === 0 && (accessYear % 100 !== 0 || accessYear % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (accessYear < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) fail(`${path}.accessed`, "expected a valid calendar date");
  });
  const sourceReferences = (value: unknown, path: string): void => {
    const refs = array(value, path, 0, 128);
    const seen = new Set<string>();
    refs.forEach((entry, i) => {
      reference(entry, `${path}[${i}]`, sourceIds, "source");
      if (seen.has(entry as string)) fail(`${path}[${i}]`, "duplicate source reference");
      seen.add(entry as string);
    });
  };
  const evidence = (entry: DataObject, path: string): void => {
    if (Object.hasOwn(entry, "sourceIds")) sourceReferences(entry.sourceIds, `${path}.sourceIds`);
    if (Object.hasOwn(entry, "evidence")) {
      if (!["documented-history", "historically-inspired", "fictional"].includes(entry.evidence as string)) fail(`${path}.evidence`, "unknown evidence classification");
      if (entry.evidence !== "fictional" && (!Array.isArray(entry.sourceIds) || entry.sourceIds.length === 0)) {
        fail(`${path}.sourceIds`, "historical evidence classifications require at least one source");
      }
    }
  };

  const stats = object(world.stats, "world.stats");
  const statIds = new Set(Object.keys(stats));
  if (statIds.size < 1 || statIds.size > 128) fail("world.stats", "expected 1..128 stat definitions");
  const statRange = (value: unknown, path: string, definition: DataObject): void => {
    const range = object(value, path, ["min", "max"]);
    const min = integer(range.min, `${path}.min`, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const max = integer(range.max, `${path}.max`, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    if (min > max) fail(path, "minimum must not exceed maximum");
    if (min < (definition.min as number) || max > (definition.max as number)) {
      fail(path, "must be within stat bounds");
    }
  };
  const gainCurve = (value: unknown, path: string, definition: DataObject): void => {
    const bands = array(value, path, 1, 16);
    const min = definition.min as number, max = definition.max as number;
    if (!Number.isFinite(max - min)) fail(path, "gain curves require a finite stat span");
    let previousFrom = -Infinity, previousMultiplier = 1;
    bands.forEach((entry, i) => {
      const bandPath = `${path}[${i}]`;
      const band = object(entry, bandPath, ["from", "multiplier"]);
      const from = number(band.from, `${bandPath}.from`);
      if (from < min || from >= max || from <= previousFrom || i === 0 && from !== min) fail(`${bandPath}.from`, "thresholds must start at minimum, increase and stay below maximum");
      const multiplier = number(band.multiplier, `${bandPath}.multiplier`);
      if (multiplier <= 0 || multiplier > previousMultiplier) fail(`${bandPath}.multiplier`, "multipliers must be positive, at most 1 and nonincreasing");
      previousFrom = from;
      previousMultiplier = multiplier;
    });
  };
  for (const [key, value] of Object.entries(stats)) {
    id(key, `world.stats.${key}`);
    const path = `world.stats.${key}`;
    const definition = object(value, path, ["label", "min", "max", "initial", "initialRange", "gainCurve"], ["label", "min", "max", "initial"]);
    string(definition.label, `${path}.label`, 300);
    const min = number(definition.min, `${path}.min`);
    const max = number(definition.max, `${path}.max`);
    const initial = number(definition.initial, `${path}.initial`);
    if (min >= max) fail(path, "min must be less than max");
    if (initial < min || initial > max) fail(`${path}.initial`, "must be within stat bounds");
    if (Object.hasOwn(definition, "initialRange")) statRange(definition.initialRange, `${path}.initialRange`, definition);
    if (Object.hasOwn(definition, "gainCurve")) gainCurve(definition.gainCurve, `${path}.gainCurve`, definition);
  }
  const economy = Object.hasOwn(world, "economy") ? object(world.economy, "world.economy",
    ["stat", "currency", "unitsPerPoint", "description", "sourceIds", "assets", "autoDebtRepayment", "uncappedResources", "moneylender", "market"], ["stat", "currency", "unitsPerPoint", "description", "assets"]) : undefined;
  const market = economy && Object.hasOwn(economy, "market") ? object(economy.market, "world.economy.market",
    ["minAge", "feePercent", "maxQuantity", "maxOrders", "traderJob", "traderYears", "traderFocusActivity", "goods", "shocks", "orderLimits"],
    ["minAge", "feePercent", "maxQuantity", "maxOrders", "traderJob", "traderYears", "traderFocusActivity", "goods", "shocks"]) : undefined;
  const marketGoods = new Set<string>();
  const moneylender = economy && Object.hasOwn(economy, "moneylender") ? object(economy.moneylender, "world.economy.moneylender",
    ["title", "principal", "fee", "termYears", "threatAfterYears", "attackAfterYears", "extensionYears", "extensionFee", "maxExtensions", "events"]) : undefined;
  const moneyLimit = 1_000_000_000_000;
  const assets = economy ? array(economy.assets, "world.economy.assets", 0, 128) : [];
  const assetIds = unique(assets, "world.economy.assets");
  const assetRange = (value: unknown, path: string): { min: number; max: number } => {
    const range = object(value, path, ["min", "max"]);
    const min = integer(range.min, `${path}.min`, 0, moneyLimit);
    const max = integer(range.max, `${path}.max`, 0, moneyLimit);
    if (min > max) fail(path, "minimum must not exceed maximum");
    return { min, max };
  };
  if (economy) {
    reference(economy.stat, "world.economy.stat", statIds, "stat");
    const scale = integer(economy.unitsPerPoint, "world.economy.unitsPerPoint", 1, 1_000_000);
    string(economy.description, "world.economy.description");
    if (Object.hasOwn(economy, "autoDebtRepayment")) bool(economy.autoDebtRepayment, "world.economy.autoDebtRepayment");
    if (Object.hasOwn(economy, "uncappedResources")) bool(economy.uncappedResources, "world.economy.uncappedResources");
    const currency = object(economy.currency, "world.economy.currency", ["singular", "plural", "short"]);
    for (const field of ["singular", "plural", "short"]) string(currency[field], `world.economy.currency.${field}`, 100);
    if (Object.hasOwn(economy, "sourceIds")) sourceReferences(economy.sourceIds, "world.economy.sourceIds");
    const definition = stats[economy.stat as string] as DataObject;
    if (Object.hasOwn(definition, "gainCurve")) fail(`world.stats.${economy.stat}.gainCurve`, "currency-backed wealth must keep exact accounting without gain multipliers");
    for (const field of ["min", "max", "initial"]) {
      const value = (definition[field] as number) * scale;
      if (!Number.isSafeInteger(value) || value < 0 || value > moneyLimit) fail(`world.stats.${economy.stat}.${field}`, "economy stat must scale to a whole, nonnegative currency amount within 1000000000000");
    }
    let maximumAssetValue = 0, maximumAssetIncome = 0;
    assets.forEach((entry, i) => {
      const path = `world.economy.assets[${i}]`;
      const asset = object(entry, path, ["id", "title", "description", "value", "maxOwned", "yearlyIncome", "initialRange", "category", "context"], ["id", "title", "description", "value"]);
      string(asset.title, `${path}.title`, 300);
      string(asset.description, `${path}.description`);
      if (Object.hasOwn(asset, "category")) string(asset.category, `${path}.category`, 100);
      const value = integer(asset.value, `${path}.value`, 0, 1_000_000_000);
      const maxOwned = Object.hasOwn(asset, "maxOwned") ? integer(asset.maxOwned, `${path}.maxOwned`, 1, 1_000_000) : 0;
      const income = Object.hasOwn(asset, "yearlyIncome") ? integer(asset.yearlyIncome, `${path}.yearlyIncome`, 0, 1_000_000_000) : 0;
      const maximumStart = Object.hasOwn(asset, "initialRange") ? assetRange(asset.initialRange, `${path}.initialRange`).max : 0;
      if (!economy.uncappedResources && maxOwned > 0 && maximumStart > maxOwned) fail(`${path}.initialRange`, "starting quantity must not exceed the legacy ownership limit");
      const maximum = economy.uncappedResources ? maximumStart : Math.max(maximumStart, maxOwned);
      maximumAssetValue += value * maximum;
      maximumAssetIncome += income * maximum;
    });
    if (maximumAssetValue > moneyLimit || maximumAssetIncome > moneyLimit) fail("world.economy.assets", "maximum combined asset value and annual income must each stay within 1000000000000");
  }
  const requireEconomy = (path: string): void => { if (!economy) fail(path, "requires an economy definition"); };
  const requireMoneylender = (path: string): void => { if (!moneylender) fail(path, "requires a moneylender definition"); };
  if (moneylender) {
    const path = "world.economy.moneylender";
    string(moneylender.title, `${path}.title`, 160);
    const principal = integer(moneylender.principal, `${path}.principal`, 1, 1_000_000_000);
    const fee = integer(moneylender.fee, `${path}.fee`, 0, 1_000_000_000);
    integer(moneylender.termYears, `${path}.termYears`, 1, maxAge);
    const threat = integer(moneylender.threatAfterYears, `${path}.threatAfterYears`, 1, maxAge);
    integer(moneylender.attackAfterYears, `${path}.attackAfterYears`, threat + 1, maxAge);
    integer(moneylender.extensionYears, `${path}.extensionYears`, 1, maxAge);
    const extensionFee = integer(moneylender.extensionFee, `${path}.extensionFee`, 0, 1_000_000_000);
    const extensions = integer(moneylender.maxExtensions, `${path}.maxExtensions`, 0, 10);
    if (principal + fee + extensionFee * extensions > moneyLimit) fail(path, "maximum contract balance must stay within 1000000000000");
    object(moneylender.events, `${path}.events`, ["due", "threat", "attack"]);
  }
  const flags = object(world.flags, "world.flags");
  const flagIds = new Set(Object.keys(flags));
  if (flagIds.size > 512) fail("world.flags", "expected at most 512 flags");
  for (const [key, value] of Object.entries(flags)) {
    id(key, `world.flags.${key}`);
    const path = `world.flags.${key}`;
    const definition = object(value, path, ["label", "initial"]);
    string(definition.label, `${path}.label`, 300);
    bool(definition.initial, `${path}.initial`);
  }
  const origins = array(world.origins, "world.origins", 1, 256);
  const originIds = unique(origins, "world.origins");
  const events = array(world.events, "world.events");
  const eventIds = unique(events, "world.events");
  const endings = array(world.endings, "world.endings", 1, 256);
  const endingIds = unique(endings, "world.endings");
  reference(world.defaultEnding, "world.defaultEnding", endingIds, "ending");

  const character = Object.hasOwn(world, "character") ? object(world.character, "world.character",
    ["skills", "jobs", "partners", "activities", "childNames", "deathCauses", "deathCauseDescription", "playerNames", "requireIntroductions", "exclusiveCourtship", "identity", "proceduralPartners", "socialRelationships", "extendedSocialRoles", "familyBackgrounds", "encounterPacing"],
    ["skills", "jobs", "partners", "activities", "childNames", "deathCauses", "deathCauseDescription"]) : undefined;
  if (moneylender && (!character || maxAge < 19)) fail("world.economy.moneylender", "requires a character definition and a life extending beyond age 18");
  const skills = character ? object(character.skills, "world.character.skills") : {};
  const skillIds = new Set(Object.keys(skills));
  if (character && (skillIds.size < 1 || skillIds.size > 128)) fail("world.character.skills", "expected 1..128 skills");
  for (const [key, entry] of Object.entries(skills)) {
    const path = `world.character.skills.${key}`;
    id(key, path);
    const definition = object(entry, path,
      ["label", "min", "max", "initial", "description", "branch", "tier", "prerequisites", "trainingActivity", "gainCurve"],
      ["label", "min", "max", "initial"]);
    string(definition.label, `${path}.label`, 300);
    const min = number(definition.min, `${path}.min`);
    const max = number(definition.max, `${path}.max`);
    const initial = number(definition.initial, `${path}.initial`);
    if (min >= max || initial < min || initial > max) fail(path, "expected increasing bounds containing initial skill");
    if (Object.hasOwn(definition, "description")) string(definition.description, `${path}.description`, 1_000);
    if (Object.hasOwn(definition, "branch")) string(definition.branch, `${path}.branch`, 100);
    if (Object.hasOwn(definition, "tier")) integer(definition.tier, `${path}.tier`, 0, 8);
    if (Object.hasOwn(definition, "prerequisites")) object(definition.prerequisites, `${path}.prerequisites`);
    if (Object.hasOwn(definition, "trainingActivity")) id(definition.trainingActivity, `${path}.trainingActivity`);
    if (Object.hasOwn(definition, "gainCurve")) gainCurve(definition.gainCurve, `${path}.gainCurve`, definition);
  }
  for (const [key, entry] of Object.entries(skills)) {
    const definition = entry as DataObject;
    for (const [prerequisite, value] of Object.entries((definition.prerequisites ?? {}) as DataObject)) {
      const path = `world.character.skills.${key}.prerequisites.${prerequisite}`;
      reference(prerequisite, path, skillIds, "skill");
      if (prerequisite === key) fail(path, "a skill cannot require itself");
      const threshold = number(value, path);
      const requiredSkill = skills[prerequisite] as DataObject;
      if (threshold <= (requiredSkill.min as number) || threshold > (requiredSkill.max as number)) {
        fail(path, "skill prerequisite must be above its minimum and at most its maximum");
      }
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visitSkill = (key: string): void => {
    if (visited.has(key)) return;
    if (visiting.has(key)) fail(`world.character.skills.${key}.prerequisites`, "skill prerequisites contain a cycle");
    visiting.add(key);
    for (const prerequisite of Object.keys(((skills[key] as DataObject).prerequisites ?? {}) as DataObject)) visitSkill(prerequisite);
    visiting.delete(key);
    visited.add(key);
  };
  skillIds.forEach(visitSkill);
  if (Object.hasOwn(world, "vocations")) {
    if (!world.economy || !character) fail("world.vocations", "requires economy and characters");
    validateVocations(world.vocations, skillIds, fail);
  }

  if (Object.hasOwn(world, "capabilities")) {
    if (!world.vocations || !world.demo || !character || !world.economy) fail("world.capabilities", "requires a household economy, vocations and character skills");
    validateCapabilities(world.capabilities, skillIds, fail, statIds);
  }
  const capabilityReference = (value: unknown, path: string): void => {
    if (typeof value !== "string" || !world.capabilities || !(world.capabilities as CapabilityDefinition).nodes.some(node => node.id === value)) fail(path, "unknown capability node");
  };
  const jobs = character ? array(character.jobs, "world.character.jobs", 0, 128) : [];
  const jobIds = unique(jobs, "world.character.jobs");
  if (market) {
    const path = "world.economy.market";
    if (!character) fail(path, "requires a character definition");
    integer(market.minAge, `${path}.minAge`, 0, maxAge);
    const fee = number(market.feePercent, `${path}.feePercent`);
    if (fee < 0 || fee > 50) fail(`${path}.feePercent`, "expected a percentage in 0..50");
    const maxQuantity = integer(market.maxQuantity, `${path}.maxQuantity`, 1, 1_000_000);
    const maxOrders = integer(market.maxOrders, `${path}.maxOrders`, 1, 128);
    if (Object.hasOwn(market, "orderLimits")) {
      const location = `${path}.orderLimits`;
      const limits = object(market.orderLimits, location, ["household", "professional"]);
      const profiles = ["household", "professional"].map(name => {
        const profile = object(limits[name], `${location}.${name}`, ["perOrder", "perYear"]);
        const perOrder = integer(profile.perOrder, `${location}.${name}.perOrder`, 1, maxQuantity);
        const perYear = integer(profile.perYear, `${location}.${name}.perYear`, perOrder, maxQuantity * maxOrders);
        return { perOrder, perYear };
      });
      if (profiles[1].perOrder < profiles[0].perOrder || profiles[1].perYear < profiles[0].perYear) {
        fail(`${location}.professional`, "professional order limits must not be below household limits");
      }
    }
    integer(market.traderYears, `${path}.traderYears`, 1, maxAge);
    reference(market.traderJob, `${path}.traderJob`, jobIds, "job");
    id(market.traderFocusActivity, `${path}.traderFocusActivity`);
    const goods = array(market.goods, `${path}.goods`, 1, 128);
    goods.forEach((entry, i) => {
      const location = `${path}.goods[${i}]`;
      reference(entry, location, assetIds, "asset");
      const key = entry as string;
      if (marketGoods.has(key)) fail(location, "duplicate market good");
      marketGoods.add(key);
      const asset = assets.find(candidate => (candidate as DataObject).id === key) as DataObject;
      const price = integer(asset.value, `${location}.value`, 1, 1_000_000_000);
      // Live event modifiers are clamped to 4x before fees and whole-unit rounding.
      const maxTotal = Math.ceil(price * 4 * (1 + fee / 100)) * maxQuantity;
      if (!Number.isSafeInteger(maxTotal) || maxTotal > moneyLimit) fail(location, "maximum order value must stay within 1000000000000");
    });
    const shocks = array(market.shocks, `${path}.shocks`, 0, 128);
    const seenEvents = new Set<string>();
    shocks.forEach((entry, i) => {
      const location = `${path}.shocks[${i}]`;
      const shock = object(entry, location, ["eventId", "title", "durationYears", "priceMultipliers"]);
      reference(shock.eventId, `${location}.eventId`, eventIds, "event");
      if (seenEvents.has(shock.eventId as string)) fail(`${location}.eventId`, "duplicate market event");
      seenEvents.add(shock.eventId as string);
      string(shock.title, `${location}.title`, 300);
      integer(shock.durationYears, `${location}.durationYears`, 1, maxAge);
      const multipliers = object(shock.priceMultipliers, `${location}.priceMultipliers`);
      if (Object.keys(multipliers).length === 0) fail(`${location}.priceMultipliers`, "requires at least one market good");
      for (const [asset, value] of Object.entries(multipliers)) {
        reference(asset, `${location}.priceMultipliers.${asset}`, marketGoods, "market good");
        const multiplier = number(value, `${location}.priceMultipliers.${asset}`);
        if (multiplier < 0.25 || multiplier > 4) fail(`${location}.priceMultipliers.${asset}`, "expected a multiplier in 0.25..4");
      }
    });
  }
  const legacy = Object.hasOwn(world, "legacy") ? object(world.legacy, "world.legacy", ["routes", "achievements"]) : undefined;
  const legacyRoutes = legacy ? array(legacy.routes, "world.legacy.routes", 1, 64) : [];
  const legacyRouteIds = unique(legacyRoutes, "world.legacy.routes");
  const achievements = legacy ? array(legacy.achievements, "world.legacy.achievements", 1, 256) : [];
  const achievementIds = unique(achievements, "world.legacy.achievements");
  if (legacy && !character) fail("world.legacy", "requires a character definition");
  const references = (value: unknown, path: string, ids: Set<string>, kind: string, min = 0): void => {
    const seen = new Set<string>();
    array(value, path, min, 128).forEach((entry, i) => {
      reference(entry, `${path}[${i}]`, ids, kind);
      if (seen.has(entry as string)) fail(`${path}[${i}]`, "duplicate reference");
      seen.add(entry as string);
    });
  };
  legacyRoutes.forEach((entry, i) => {
    const path = `world.legacy.routes[${i}]`;
    const route = object(entry, path, ["id", "title", "description", "skillIds", "jobIds", "achievementIds", "earlyInterestFlag", "stages"], ["id", "title", "description", "skillIds", "jobIds", "achievementIds"]);
    string(route.title, `${path}.title`, 100);
    string(route.description, `${path}.description`, 1000);
    references(route.skillIds, `${path}.skillIds`, skillIds, "skill", 1);
    references(route.jobIds, `${path}.jobIds`, jobIds, "job");
    references(route.achievementIds, `${path}.achievementIds`, achievementIds, "achievement", 1);
    if (Object.hasOwn(route, "earlyInterestFlag")) reference(route.earlyInterestFlag, `${path}.earlyInterestFlag`, flagIds, "flag");
    if (Object.hasOwn(route, "stages")) {
      const staged = new Set<string>();
      array(route.stages, `${path}.stages`, 1, 16).forEach((entry, index) => {
        const stagePath = `${path}.stages[${index}]`;
        const stage = object(entry, stagePath, ["title", "achievementIds"]);
        string(stage.title, `${stagePath}.title`, 100);
        references(stage.achievementIds, `${stagePath}.achievementIds`, new Set(route.achievementIds as string[]), "route achievement", 1);
        for (const id of stage.achievementIds as string[]) {
          if (staged.has(id)) fail(`${stagePath}.achievementIds`, "achievement appears in more than one stage");
          staged.add(id);
        }
      });
    }
    for (const achievement of route.achievementIds as string[]) {
      if ((achievements.find(item => (item as DataObject).id === achievement) as DataObject).routeId !== route.id) fail(`${path}.achievementIds`, "achievement belongs to a different route");
    }
  });
  achievements.forEach((entry, i) => {
    const path = `world.legacy.achievements[${i}]`;
    const achievement = object(entry, path, ["id", "routeId", "title", "description", "kind", "nameTemplate", "people", "evidence", "sourceIds"], ["id", "routeId", "title", "description", "kind", "nameTemplate", "people"]);
    reference(achievement.routeId, `${path}.routeId`, legacyRouteIds, "legacy route");
    const route = legacyRoutes.find(item => (item as DataObject).id === achievement.routeId) as DataObject;
    if (!(route.achievementIds as string[]).includes(achievement.id as string)) fail(path, "achievement must be listed in its route");
    string(achievement.title, `${path}.title`, 200);
    string(achievement.description, `${path}.description`, 1000);
    string(achievement.nameTemplate, `${path}.nameTemplate`, 200);
    if (!["ordinary", "prestige", "ultimate"].includes(achievement.kind as string)) fail(`${path}.kind`, "expected ordinary, prestige or ultimate");
    const people = array(achievement.people, `${path}.people`, 1, 8);
    people.forEach((person, j) => string(person, `${path}.people[${j}]`, 100));
    if (new Set(people).size !== people.length) fail(`${path}.people`, "duplicate contact");
    evidence(achievement, path);
  });
  const partners = character ? array(character.partners, "world.character.partners", 0, 128) : [];
  const partnerIds = unique(partners, "world.character.partners");
  const deathCauses = character ? array(character.deathCauses, "world.character.deathCauses", 1, 256) : [];
  const deathCauseIds = unique(deathCauses, "world.character.deathCauses");
  const deathEndingIds = new Set(endings.filter(entry => (entry as DataObject).kind === "death").map(entry => (entry as DataObject).id as string));
  const requireCharacter = (path: string): void => {
    if (!character) fail(path, "requires a character definition");
  };
  const healthFields = ["description", "sourceIds", "stat", "criticalHealth", "declineCondition", "careDecision", "incidenceBands", "declineBands", "supportRecoveryBonus", "conditions"];
  const health = Object.hasOwn(world, "health") ? object(world.health, "world.health", [...healthFields, "mortalityCalibration"], healthFields) : undefined;
  const healthConditions = health ? array(health.conditions, "world.health.conditions", 1, 64) : [];
  const healthConditionIds = unique(healthConditions, "world.health.conditions");
  if (Object.hasOwn(world, "knowledge")) {
    const model = object(world.knowledge, "world.knowledge", ["stat", "minAge", "idleGraceYears", "idleLoss", "ageBands", "description"]);
    reference(model.stat, "world.knowledge.stat", statIds, "stat");
    if (model.stat === economy?.stat || model.stat === health?.stat) fail("world.knowledge.stat", "knowledge must use a separate stat from health and economy");
    string(model.description, "world.knowledge.description");
    integer(model.minAge, "world.knowledge.minAge", 0, maxAge - 1);
    integer(model.idleGraceYears, "world.knowledge.idleGraceYears", 0, maxAge);
    const definition = stats[model.stat as string] as DataObject;
    const span = (definition.max as number) - (definition.min as number);
    const loss = (value: unknown, path: string): void => {
      const result = number(value, path);
      if (result < 0 || result > span) fail(path, "loss must be within the stat span");
    };
    loss(model.idleLoss, "world.knowledge.idleLoss");
    let nextAge = 0;
    array(model.ageBands, "world.knowledge.ageBands", 1, 128).forEach((entry, i) => {
      const path = `world.knowledge.ageBands[${i}]`;
      const band = object(entry, path, ["minAge", "maxAge", "loss"]);
      const min = integer(band.minAge, `${path}.minAge`, 0, maxAge - 1);
      const max = integer(band.maxAge, `${path}.maxAge`, min, maxAge - 1);
      if (min !== nextAge) fail(`${path}.minAge`, "knowledge bands must be ordered and contiguous from age zero");
      nextAge = max + 1;
      loss(band.loss, `${path}.loss`);
    });
    if (nextAge !== maxAge) fail("world.knowledge.ageBands", "knowledge bands must cover every age below maxAge");
  }
  const relationships = Object.hasOwn(world, "relationships") ? object(world.relationships, "world.relationships", ["description", "initialCloseness", "childCloseness", "decayAfterYears", "yearlyDecay", "marriageMinimum", "supportThreshold", "maxHealthSupport"]) : undefined;
  const requireHealth = (path: string): void => { if (!health) fail(path, "requires a health definition"); };
  const requireRelationships = (path: string): void => { if (!relationships) fail(path, "requires a relationship definition"); };
  const socialRole = (value: Record<string, unknown>, path: string): void => {
    requireCharacter(path);
    requireRelationships(path);
    if (character?.socialRelationships !== true) fail(path, "requires socialRelationships");
    reference(value.partner, `${path}.partner`, partnerIds, "partner");
    const allowed = character?.extendedSocialRoles === true ? ["friend", "business-partner", "teacher", "disciple", "enemy"] : ["friend", "business-partner"];
    if (!allowed.includes(value.role as string)) fail(`${path}.role`, `expected ${allowed.join(", ")}`);
    bool(value.active, `${path}.active`);
  };

  const condition = (value: unknown, path: string, depth = 0): void => {
    if (depth > 32) fail(path, "condition nesting exceeds 32 levels");
    const rule = object(value, path, undefined, ["type"]);
    switch (rule.type) {
      case "accomplishment":
        object(rule, path, ["type", "achievement", "minYears"], ["type", "achievement"]);
        reference(rule.achievement, `${path}.achievement`, achievementIds, "achievement");
        if (Object.hasOwn(rule, "minYears")) integer(rule.minYears, `${path}.minYears`, 0, maxAge);
        break;
      case "cash":
      case "debt":
        object(rule, path, ["type", "op", "value"]);
        requireEconomy(path);
        if (!OPERATORS.has(rule.op as string)) fail(`${path}.op`, "unknown comparison operator");
        integer(rule.value, `${path}.value`, 0, moneyLimit);
        break;
      case "loan":
        object(rule, path, ["type", "status"]);
        requireMoneylender(path);
        if (!["none", "active", "due", "overdue"].includes(rule.status as string)) fail(`${path}.status`, "unknown loan status");
        break;
      case "loan-overdue":
        object(rule, path, ["type", "op", "value"]);
        requireMoneylender(path);
        if (!OPERATORS.has(rule.op as string)) fail(`${path}.op`, "unknown comparison operator");
        integer(rule.value, `${path}.value`, 0, maxAge);
        break;
      case "asset":
        object(rule, path, ["type", "asset", "op", "value"]);
        requireEconomy(path);
        reference(rule.asset, `${path}.asset`, assetIds, "asset");
        if (!OPERATORS.has(rule.op as string)) fail(`${path}.op`, "unknown comparison operator");
        integer(rule.value, `${path}.value`, 0, 1_000_000);
        break;
      case "stat":
        object(rule, path, ["type", "stat", "op", "value"]);
        reference(rule.stat, `${path}.stat`, statIds, "stat");
        if (!OPERATORS.has(rule.op as string)) fail(`${path}.op`, "unknown comparison operator");
        number(rule.value, `${path}.value`);
        break;
      case "flag":
        object(rule, path, ["type", "flag", "value"]);
        reference(rule.flag, `${path}.flag`, flagIds, "flag");
        bool(rule.value, `${path}.value`);
        break;
      case "age":
      case "year":
        object(rule, path, ["type", "op", "value"]);
        if (!OPERATORS.has(rule.op as string)) fail(`${path}.op`, "unknown comparison operator");
        if (rule.type === "age") integer(rule.value, `${path}.value`, 0, Number.MAX_SAFE_INTEGER);
        else year(rule.value, `${path}.value`);
        break;
      case "origin":
        object(rule, path, ["type", "origin"]);
        reference(rule.origin, `${path}.origin`, originIds, "origin");
        break;
      case "skill":
        object(rule, path, ["type", "skill", "op", "value"]);
        reference(rule.skill, `${path}.skill`, skillIds, "skill");
        if (!OPERATORS.has(rule.op as string)) fail(`${path}.op`, "unknown comparison operator");
        number(rule.value, `${path}.value`);
        break;
      case "job":
        object(rule, path, ["type", "job"]);
        requireCharacter(path);
        if (rule.job !== null) reference(rule.job, `${path}.job`, jobIds, "job");
        break;
      case "relationship":
        object(rule, path, ["type", "status", "partner"], ["type", "status"]);
        requireCharacter(path);
        if (!["single", "courting", "married", "divorced"].includes(rule.status as string)) fail(`${path}.status`, "unknown relationship status");
        if (Object.hasOwn(rule, "partner")) reference(rule.partner, `${path}.partner`, partnerIds, "partner");
        break;
      case "known-partner":
        object(rule, path, ["type", "partner"]);
        requireCharacter(path);
        reference(rule.partner, `${path}.partner`, partnerIds, "partner");
        break;
      case "social-role":
        object(rule, path, ["type", "partner", "role", "active"]);
        socialRole(rule, path);
        break;
      case "children":
        object(rule, path, ["type", "op", "value"]);
        requireCharacter(path);
        if (!OPERATORS.has(rule.op as string)) fail(`${path}.op`, "unknown comparison operator");
        integer(rule.value, `${path}.value`, 0, 8);
        break;
      case "child-age": {
        object(rule, path, ["type", "min", "max"]);
        requireCharacter(path);
        const min = integer(rule.min, `${path}.min`, 0, 10_000);
        integer(rule.max, `${path}.max`, min, 10_000);
        break;
      }
      case "has-condition":
        object(rule, path, ["type", "condition"], ["type"]);
        requireHealth(path);
        if (Object.hasOwn(rule, "condition")) reference(rule.condition, `${path}.condition`, healthConditionIds, "health condition");
        break;
      case "closeness":
        object(rule, path, ["type", "partner", "op", "value"], ["type", "op", "value"]);
        requireCharacter(path);
        requireRelationships(path);
        if (Object.hasOwn(rule, "partner")) reference(rule.partner, `${path}.partner`, partnerIds, "partner");
        if (!OPERATORS.has(rule.op as string)) fail(`${path}.op`, "unknown comparison operator");
        integer(rule.value, `${path}.value`, 0, 100);
        break;
      case "all":
      case "any":
        object(rule, path, ["type", "conditions"]);
        array(rule.conditions, `${path}.conditions`, 1, 256).forEach((entry, i) => condition(entry, `${path}.conditions[${i}]`, depth + 1));
        break;
      case "not":
        object(rule, path, ["type", "condition"]);
        condition(rule.condition, `${path}.condition`, depth + 1);
        break;
      case "capability":
        object(rule, path, ["type", "node"]);
        capabilityReference(rule.node, `${path}.node`);
        break;
      case "vocation":
        object(rule, path, ["type", "action", "count"]);
        if (!world.vocations) fail(path, "requires vocation rules");
        reference(rule.action, `${path}.action`, new Set(Object.keys((world.vocations as VocationDefinition).actions ?? {})), "vocation action");
        integer(rule.count, `${path}.count`, 1, 10000);
        break;
      case "demo":
        object(rule, path, ["type", "condition"]);
        requireDemo(path);
        validateDemoCondition(rule, path, fail);
        break;
      default:
        if (!validatePathsCondition(rule, path, world.paths, { fail, object, integer, string, operators: OPERATORS, materials: new Set(Object.keys((world.vocations as VocationDefinition | undefined)?.materials ?? {})) })) fail(`${path}.type`, "unknown condition type");
    }
  };
  const effects = (value: unknown, path: string, allowMastery = false, allowAccomplishment = false, allowTrainingGainModifiers = false): void => {
    array(value, path, 0, 128).forEach((entry, i) => {
      const location = `${path}[${i}]`;
      const effect = object(entry, location, undefined, ["type"]);
      switch (effect.type) {
        case "accomplishment":
          object(effect, location, ["type", "achievement"]);
          if (!allowAccomplishment) fail(location, "accomplishments require an accepted decision or activity outcome");
          reference(effect.achievement, `${location}.achievement`, achievementIds, "achievement");
          break;
        case "mastery":
          object(effect, location, ["type", "target", "id"]);
          if (!allowMastery) fail(location, "mastery is permitted only in rare encounter choice outcomes");
          if (effect.target !== "stat" && effect.target !== "skill") fail(`${location}.target`, "expected stat or skill");
          if (effect.target === "stat") {
            reference(effect.id, `${location}.id`, statIds, "stat");
            if (economy && effect.id === economy.stat) fail(`${location}.id`, "mastery cannot target the economy stat; use explicit currency effects");
          } else {
            requireCharacter(location);
            reference(effect.id, `${location}.id`, skillIds, "skill");
          }
          break;
        case "cash":
        case "debt":
          object(effect, location, ["type", "delta"]);
          requireEconomy(location);
          integer(effect.delta, `${location}.delta`, -1_000_000_000, 1_000_000_000);
          break;
        case "loan":
          object(effect, location, ["type", "action", "amount"], ["type", "action"]);
          requireMoneylender(location);
          if (!["borrow", "repay", "extend"].includes(effect.action as string)) fail(`${location}.action`, "unknown loan action");
          if (Object.hasOwn(effect, "amount")) {
            if (effect.action !== "repay") fail(`${location}.amount`, "an amount is permitted only for repayment");
            integer(effect.amount, `${location}.amount`, 1, 1_000_000_000);
          }
          break;
        case "asset":
          object(effect, location, ["type", "asset", "delta"]);
          requireEconomy(location);
          reference(effect.asset, `${location}.asset`, assetIds, "asset");
          integer(effect.delta, `${location}.delta`, -1_000_000, 1_000_000);
          break;
        case "stat":
          object(effect, location, ["type", "stat", "delta"]);
          reference(effect.stat, `${location}.stat`, statIds, "stat");
          number(effect.delta, `${location}.delta`);
          if (economy && effect.stat === economy.stat) {
            const change = (effect.delta as number) * (economy.unitsPerPoint as number);
            if (!Number.isSafeInteger(change) || Math.abs(change) > 1_000_000_000) fail(`${location}.delta`, "economy stat changes must scale to whole currency amounts within 1000000000");
          }
          break;
        case "flag":
          object(effect, location, ["type", "flag", "value"]);
          reference(effect.flag, `${location}.flag`, flagIds, "flag");
          bool(effect.value, `${location}.value`);
          break;
        case "skill":
          object(effect, location, ["type", "skill", "delta", "gainModifiers"], ["type", "skill", "delta"]);
          reference(effect.skill, `${location}.skill`, skillIds, "skill");
          number(effect.delta, `${location}.delta`);
          if (Object.hasOwn(effect, "gainModifiers")) {
            if (!allowTrainingGainModifiers) fail(`${location}.gainModifiers`, "gain modifiers are permitted only in paid training activity outcomes");
            if ((effect.delta as number) <= 0) fail(`${location}.delta`, "training gain modifiers require a positive skill delta");
            const seen = new Set<string>();
            array(effect.gainModifiers, `${location}.gainModifiers`, 1, 16).forEach((entry, j) => {
              const path = `${location}.gainModifiers[${j}]`;
              const modifier = object(entry, path, ["flag", "multiplier", "reason"]);
              reference(modifier.flag, `${path}.flag`, flagIds, "flag");
              if (seen.has(modifier.flag as string)) fail(`${path}.flag`, "duplicate training modifier flag");
              seen.add(modifier.flag as string);
              const multiplier = number(modifier.multiplier, `${path}.multiplier`);
              if (multiplier < 1 || multiplier > 1.2) fail(`${path}.multiplier`, "expected a training multiplier in 1..1.2");
              string(modifier.reason, `${path}.reason`, 160);
            });
          }
          break;
        case "job":
          object(effect, location, ["type", "job"]);
          requireCharacter(location);
          if (effect.job !== null) reference(effect.job, `${location}.job`, jobIds, "job");
          break;
        case "relationship":
          object(effect, location, ["type", "partner", "status"]);
          reference(effect.partner, `${location}.partner`, partnerIds, "partner");
          if (effect.status !== "courting" && effect.status !== "married") fail(`${location}.status`, "expected courting or married");
          break;
        case "introduce":
          object(effect, location, ["type", "partner"]);
          requireCharacter(location);
          reference(effect.partner, `${location}.partner`, partnerIds, "partner");
          break;
        case "social-role":
          object(effect, location, ["type", "partner", "role", "active"]);
          socialRole(effect, location);
          break;
        case "end-courtship":
        case "divorce":
        case "child":
          object(effect, location, ["type"]);
          requireCharacter(location);
          break;
        case "condition":
          object(effect, location, ["type", "condition"]);
          requireHealth(location);
          reference(effect.condition, `${location}.condition`, healthConditionIds, "health condition");
          break;
        case "care": {
          object(effect, location, ["type", "amount"]);
          requireHealth(location);
          const amount = number(effect.amount, `${location}.amount`);
          if (amount <= 0 || amount > 1) fail(`${location}.amount`, "expected care in (0, 1]");
          break;
        }
        case "closeness":
          object(effect, location, ["type", "target", "partner", "delta"], ["type", "target", "delta"]);
          requireCharacter(location);
          requireRelationships(location);
          if (effect.target !== "partner" && effect.target !== "children") fail(`${location}.target`, "expected partner or children");
          if (Object.hasOwn(effect, "partner")) {
            if (effect.target !== "partner") fail(`${location}.partner`, "a children effect cannot target a partner");
            reference(effect.partner, `${location}.partner`, partnerIds, "partner");
          }
          integer(effect.delta, `${location}.delta`, -100, 100);
          break;
        case "end":
          object(effect, location, ["type", "ending", "deathCause"], ["type", "ending"]);
          reference(effect.ending, `${location}.ending`, endingIds, "ending");
          if (health && deathEndingIds.has(effect.ending as string) && !Object.hasOwn(effect, "deathCause")) fail(`${location}.deathCause`, "health worlds require an explicit cause for fatal authored effects");
          if (Object.hasOwn(effect, "deathCause")) {
            requireCharacter(location);
            reference(effect.deathCause, `${location}.deathCause`, deathCauseIds, "death cause");
            if (!deathEndingIds.has(effect.ending as string)) fail(`${location}.ending`, "an explicit death cause requires a death ending");
          }
          break;
        case "capability":
          object(effect, location, ["type", "node"]);
          capabilityReference(effect.node, `${location}.node`);
          if (!location.startsWith("world.character.activities[")) fail(location, "capability proof work requires an explicit annual activity");
          break;
        case "vocation":
          object(effect, location, ["type", "action"]);
          if (!world.vocations) fail(location, "requires vocation rules");
          reference(effect.action, `${location}.action`, new Set(Object.keys((world.vocations as VocationDefinition).actions)), "vocation action");
          const vocationAction = (world.vocations as VocationDefinition).actions[effect.action as string];
          if ((vocationAction.kind === "make" || vocationAction.kind === "work") && !location.startsWith("world.character.activities[")) fail(location, "vocation work requires an explicit annual activity");
          break;
        case "demo":
          object(effect, location, ["type", "effect"]);
          requireDemo(location);
          validateDemoEffect(effect, location, fail, demoGrainGain);
          break;
        default:
          if (!validatePathsEffect(effect, location, world.paths, { fail, object, integer, string, operators: OPERATORS, materials: new Set(Object.keys((world.vocations as VocationDefinition | undefined)?.materials ?? {})) })) fail(`${location}.type`, "unknown effect type");
      }
    });
  };

  /** Check the full conditional-weight budget, not just today's active rules. */
  const outcomeDefinition = (entry: unknown, path: string, allowMastery = false, training = false): number => {
    const outcome = object(entry, path, ["id", "text", "weight", "effects", "weightModifiers"], ["id", "text", "weight", "effects"]);
    string(outcome.text, `${path}.text`);
    const base = weight(outcome.weight, `${path}.weight`);
    effects(outcome.effects, `${path}.effects`, allowMastery, true, training);
    const effectList = outcome.effects as DataObject[];
    if (effectList.some(effect => effect.type === "skill" && Object.hasOwn(effect, "gainModifiers"))) {
      let paid = false;
      for (const effect of effectList) {
        if (effect.type === "end") break;
        if (effect.type === "cash" && (effect.delta as number) < 0 ||
          effect.type === "stat" && effect.stat === (economy?.stat ?? "wealth") && (effect.delta as number) < 0) paid = true;
      }
      if (!paid) fail(`${path}.effects`, "training gain modifiers require an actual cash or Wealth payment before the outcome ends");
    }
    for (const effect of outcome.effects as DataObject[]) if (effect.type === "accomplishment") {
      const achievement = achievements.find(item => (item as DataObject).id === effect.achievement) as DataObject;
      for (const person of achievement.people as string[]) if (!(outcome.text as string).includes(person)) fail(`${path}.text`, "awarding outcomes must introduce every recorded contact by name");
    }
    let maximum = base, minimum = base;
    if (Object.hasOwn(outcome, "weightModifiers")) {
      array(outcome.weightModifiers, `${path}.weightModifiers`, 1, 8).forEach((entry, i) => {
        const location = `${path}.weightModifiers[${i}]`;
        const modifier = object(entry, location, ["when", "multiplier", "reason"]);
        condition(modifier.when, `${location}.when`);
        const multiplier = number(modifier.multiplier, `${location}.multiplier`);
        if (multiplier < 0.05 || multiplier > 10) fail(`${location}.multiplier`, "expected a multiplier in 0.05..10");
        string(modifier.reason, `${location}.reason`, 160);
        maximum *= Math.max(1, multiplier);
        minimum *= Math.min(1, multiplier);
      });
      // Existing courtship adjustment can at most double or divide by ten.
      if ((outcome.effects as DataObject[]).some(effect => effect.type === "relationship" && effect.status === "courting")) {
        maximum *= 2;
        minimum *= 0.1;
      }
      if (!Number.isFinite(maximum) || maximum > Number.MAX_SAFE_INTEGER) fail(`${path}.weightModifiers`, "effective weight exceeds Number.MAX_SAFE_INTEGER");
      if (minimum === 0) fail(`${path}.weightModifiers`, "effective weight underflows to zero");
    }
    return maximum;
  };
  const opportunityDefinition = (choice: DataObject, path: string, outcomes: unknown[]): void => {
    if (!Object.hasOwn(choice, "opportunity")) return;
    const opportunity = object(choice.opportunity, `${path}.opportunity`, ["label", "outcomeIds"]);
    string(opportunity.label, `${path}.opportunity.label`, 100);
    const ids = array(opportunity.outcomeIds, `${path}.opportunity.outcomeIds`, 1, outcomes.length - 1);
    const known = new Set(outcomes.map(entry => (entry as DataObject).id as string));
    ids.forEach((entry, i) => reference(entry, `${path}.opportunity.outcomeIds[${i}]`, known, "outcome"));
    if (new Set(ids).size !== ids.length) fail(`${path}.opportunity.outcomeIds`, "duplicate outcome ID");
  };

  if (character) {
    if (Object.hasOwn(character, "requireIntroductions")) bool(character.requireIntroductions, "world.character.requireIntroductions");
    if (Object.hasOwn(character, "exclusiveCourtship")) bool(character.exclusiveCourtship, "world.character.exclusiveCourtship");
    if (Object.hasOwn(character, "proceduralPartners")) bool(character.proceduralPartners, "world.character.proceduralPartners");
    if (Object.hasOwn(character, "socialRelationships")) {
      bool(character.socialRelationships, "world.character.socialRelationships");
      if (character.socialRelationships === true && (character.proceduralPartners !== true || !relationships)) {
        fail("world.character.socialRelationships", "requires proceduralPartners and a relationship definition");
      }
    }
    if (Object.hasOwn(character, "extendedSocialRoles")) {
      bool(character.extendedSocialRoles, "world.character.extendedSocialRoles");
      if (character.extendedSocialRoles === true && character.socialRelationships !== true) fail("world.character.extendedSocialRoles", "requires socialRelationships");
    }
    if (Object.hasOwn(character, "identity")) {
      const path = "world.character.identity";
      const identity = object(character.identity, path, ["namePools", "avatarVariants"]);
      integer(identity.avatarVariants, `${path}.avatarVariants`, 1, 32);
      const pools = object(identity.namePools, `${path}.namePools`, ["male", "female"]);
      for (const sex of ["male", "female"]) {
        const names = array(pools[sex], `${path}.namePools.${sex}`, 1, 128);
        names.forEach((entry, index) => {
          const name = string(entry, `${path}.namePools.${sex}[${index}]`, 100);
          if (name !== name.trim()) fail(`${path}.namePools.${sex}[${index}]`, "name must be trimmed");
        });
        if (new Set(names).size !== names.length) fail(`${path}.namePools.${sex}`, "duplicate identity name");
      }
      if (character.proceduralPartners === true && new Set([...(pools.male as string[]), ...(pools.female as string[])]).size < partners.length + 1) {
        fail(`${path}.namePools`, "needs enough distinct names for the player and every encounter template");
      }
    }
    if (character.proceduralPartners === true && (!character.identity || character.requireIntroductions !== true)) {
      fail("world.character.proceduralPartners", "requires identity pools and requireIntroductions");
    }
    if (Object.hasOwn(character, "familyBackgrounds")) {
      const path = "world.character.familyBackgrounds";
      bool(character.familyBackgrounds, path);
      if (character.familyBackgrounds === true) {
        if (!character.identity) fail(path, "requires identity pools");
        const pools = (character.identity as { namePools: { male: string[]; female: string[] } }).namePools;
        if (pools.male.length < 4 || pools.female.length < 4) fail(path, "needs at least four names per sex for the player and natal relatives");
        if (new Set([...pools.male, ...pools.female]).size < partners.length + 7) fail(path, "needs enough distinct names for the player, natal relatives and every encounter template");
      }
    }
    if (Object.hasOwn(character, "encounterPacing")) {
      const path = "world.character.encounterPacing";
      const pacing = object(character.encounterPacing, path, ["firstMeetingChance", "meetingChance", "dateChance", "cooldownYears"]);
      if (character.proceduralPartners !== true) fail(path, "requires proceduralPartners");
      if (!world.eventPacing) fail(path, "requires world.eventPacing");
      for (const key of ["firstMeetingChance", "meetingChance", "dateChance"]) {
        const chance = number(pacing[key], `${path}.${key}`);
        if (chance < 0 || chance > 1) fail(`${path}.${key}`, "probability must be between zero and one");
      }
      integer(pacing.cooldownYears, `${path}.cooldownYears`, 0, 100);
    }
    if (Object.hasOwn(character, "playerNames")) {
      const playerNames = array(character.playerNames, "world.character.playerNames", 1, 128);
      playerNames.forEach((entry, i) => {
        const name = string(entry, `world.character.playerNames[${i}]`, 100);
        if (name !== name.trim()) fail(`world.character.playerNames[${i}]`, "name must be trimmed");
      });
      if (new Set(playerNames).size !== playerNames.length) fail("world.character.playerNames", "duplicate player name");
    }
    string(character.deathCauseDescription, "world.character.deathCauseDescription");
    const names = array(character.childNames, "world.character.childNames", 1, 128);
    names.forEach((entry, i) => string(entry, `world.character.childNames[${i}]`, 100));
    if (new Set(names).size !== names.length) fail("world.character.childNames", "duplicate child name");
    jobs.forEach((entry, i) => {
      const path = `world.character.jobs[${i}]`;
      const job = object(entry, path, ["id", "title", "description", "minAge", "requirements", "yearlyEffects", "production", "marketAccess"], ["id", "title", "description", "minAge", "yearlyEffects"]);
      string(job.title, `${path}.title`, 300);
      string(job.description, `${path}.description`);
      integer(job.minAge, `${path}.minAge`, 0, maxAge);
      if (Object.hasOwn(job, "marketAccess")) {
        if (job.marketAccess !== "full") fail(`${path}.marketAccess`, "expected the full market capability");
        if (!market) fail(`${path}.marketAccess`, "requires an annual market definition");
      }
      if (Object.hasOwn(job, "requirements")) {
        const requirements = object(job.requirements, `${path}.requirements`);
        for (const [skill, value] of Object.entries(requirements)) {
          reference(skill, `${path}.requirements.${skill}`, skillIds, "skill");
          const threshold = number(value, `${path}.requirements.${skill}`);
          const definition = skills[skill] as DataObject;
          if (threshold < (definition.min as number) || threshold > (definition.max as number)) fail(`${path}.requirements.${skill}`, "skill requirement is outside its bounds");
        }
      }
      effects(job.yearlyEffects, `${path}.yearlyEffects`);
      if (Object.hasOwn(job, "production")) {
        const location = `${path}.production`;
        if (!market) fail(location, "requires an annual market definition");
        const production = object(job.production, location, ["inputs", "outputs", "baseBatches", "skill", "skillPerBatch", "maxBatches"], ["inputs", "outputs", "baseBatches", "maxBatches"]);
        const baseBatches = integer(production.baseBatches, `${location}.baseBatches`, 1, 1_000_000);
        const maxBatches = integer(production.maxBatches, `${location}.maxBatches`, baseBatches, 1_000_000);
        if (Object.hasOwn(production, "skill") !== Object.hasOwn(production, "skillPerBatch")) fail(location, "skill and skillPerBatch must be supplied together");
        if (Object.hasOwn(production, "skill")) {
          reference(production.skill, `${location}.skill`, skillIds, "skill");
          integer(production.skillPerBatch, `${location}.skillPerBatch`, 1, 1_000_000);
        }
        for (const direction of ["inputs", "outputs"]) {
          const quantities = object(production[direction], `${location}.${direction}`);
          if (Object.keys(quantities).length === 0) fail(`${location}.${direction}`, "requires at least one market good");
          let maximumValue = 0;
          for (const [asset, value] of Object.entries(quantities)) {
            reference(asset, `${location}.${direction}.${asset}`, marketGoods, "market good");
            const count = integer(value, `${location}.${direction}.${asset}`, 1, 1_000_000);
            const definition = assets.find(candidate => (candidate as DataObject).id === asset) as DataObject;
            maximumValue += count * maxBatches * (definition.value as number) * 4;
          }
          if (!Number.isSafeInteger(maximumValue) || maximumValue > moneyLimit) fail(`${location}.${direction}`, "maximum production value must stay within 1000000000000");
        }
        if ((job.yearlyEffects as DataObject[]).some(effect =>
          (effect.type === "cash" || effect.type === "stat" && effect.stat === economy!.stat) && (effect.delta as number) > 0)) {
          fail(`${path}.yearlyEffects`, "production jobs earn from selling goods rather than an automatic salary");
        }
      }
      (job.yearlyEffects as DataObject[]).forEach((effect, j) => {
        if (!["stat", "flag", "skill", "cash"].includes(effect.type as string)) fail(`${path}.yearlyEffects[${j}].type`, "jobs can change only stats, flags, skills and cash annually");
      });
    });
    partners.forEach((entry, i) => {
      const path = `world.character.partners[${i}]`;
      const partner = object(entry, path, ["id", "name", "ageOffset", "occupation", "description"]);
      string(partner.name, `${path}.name`, 100);
      string(partner.occupation, `${path}.occupation`, 300);
      string(partner.description, `${path}.description`);
      integer(partner.ageOffset, `${path}.ageOffset`, -maxAge, maxAge);
    });
    const activities = array(character.activities, "world.character.activities", 1, 1_000);
    const activityIds = unique(activities, "world.character.activities");
    if (market) {
      reference(market.traderFocusActivity, "world.economy.market.traderFocusActivity", activityIds, "activity");
      const focus = activities.find(entry => (entry as DataObject).id === market.traderFocusActivity) as DataObject;
      if (focus.usesYearlyActivity === false) fail("world.economy.market.traderFocusActivity", "trading focus must use the yearly activity");
    }
    activities.forEach((entry, i) => {
      const path = `world.character.activities[${i}]`;
      const activity = object(entry, path, ["id", "text", "when", "outcomes", "category", "minAge", "cooldownYears", "usesYearlyActivity", "opportunity"], ["id", "text", "outcomes", "category"]);
      string(activity.text, `${path}.text`);
      if (!["training", "career", "relationship", "family", "finance"].includes(activity.category as string)) fail(`${path}.category`, "unknown activity category");
      if (Object.hasOwn(activity, "minAge")) integer(activity.minAge, `${path}.minAge`, 0, maxAge);
      if (Object.hasOwn(activity, "cooldownYears")) integer(activity.cooldownYears, `${path}.cooldownYears`, 1, maxAge);
      if (Object.hasOwn(activity, "usesYearlyActivity")) bool(activity.usesYearlyActivity, `${path}.usesYearlyActivity`);
      if (Object.hasOwn(activity, "when")) condition(activity.when, `${path}.when`);
      const outcomes = array(activity.outcomes, `${path}.outcomes`, 1, 64);
      unique(outcomes, `${path}.outcomes`);
      const weights = outcomes.map((entry, j) => outcomeDefinition(entry, `${path}.outcomes[${j}]`, false, activity.category === "training"));
      aggregate(weights, `${path}.outcomes`);
      opportunityDefinition(activity, path, outcomes);
      if (outcomes.some(outcome => {
        const effects = (outcome as DataObject).effects as DataObject[];
        return effects.filter(effect => effect.type === "capability").length > 1 || activity.usesYearlyActivity === false && effects.some(effect => effect.type === "capability");
      })) fail(path, "capability proof work must be one explicit annual action");
      if (activity.usesYearlyActivity === false && world.vocations && outcomes.some(outcome => ((outcome as DataObject).effects as DataObject[]).some(effect => {
        if (effect.type !== "vocation") return false;
        const action = (world.vocations as VocationDefinition).actions[effect.action as string];
        return action.kind === "make" || action.kind === "work";
      }))) fail(path, "vocation work must consume the annual activity");
    });
    for (const [key, entry] of Object.entries(skills)) {
      const definition = entry as DataObject;
      if (!Object.hasOwn(definition, "trainingActivity")) continue;
      const path = `world.character.skills.${key}.trainingActivity`;
      reference(definition.trainingActivity, path, activityIds, "activity");
      const activity = activities.find(candidate => (candidate as DataObject).id === definition.trainingActivity) as DataObject;
      if (activity.category !== "training") fail(path, "must reference a training activity");
      const gainsSkill = (activity.outcomes as DataObject[]).some(outcome => (outcome.effects as DataObject[])
        .some(effect => effect.type === "skill" && effect.skill === key && (effect.delta as number) > 0));
      if (!gainsSkill) fail(path, "training activity must have a positive effect for this skill");
    }
    const weights: number[] = [];
    deathCauses.forEach((entry, i) => {
      const path = `world.character.deathCauses[${i}]`;
      const cause = object(entry, path, ["id", "title", "text", "weight", "when", "choiceOnly"], ["id", "title", "text", "weight"]);
      string(cause.title, `${path}.title`, 300);
      string(cause.text, `${path}.text`);
      weights.push(weight(cause.weight, `${path}.weight`));
      if (Object.hasOwn(cause, "choiceOnly")) bool(cause.choiceOnly, `${path}.choiceOnly`);
      if (Object.hasOwn(cause, "when")) condition(cause.when, `${path}.when`);
    });
    aggregate(weights, "world.character.deathCauses");
    if (!deathCauses.some(entry => !Object.hasOwn(entry as DataObject, "when") && (entry as DataObject).choiceOnly !== true)) {
      fail("world.character.deathCauses", "requires an unconditional fallback cause available for natural sampling");
    }
  }

  // Relevance metadata is descriptive, but its links must still refer to actual
  // content. Validate after character activities have their complete ID set.
  const resourceActivityIds = new Set(character ? (character.activities as DataObject[]).map(activity => activity.id as string) : []);
  assets.forEach((entry, i) => {
    const asset = entry as DataObject;
    if (!Object.hasOwn(asset, "context")) return;
    const path = `world.economy.assets[${i}].context`;
    const context = object(asset.context, path, ["origins", "jobs", "activities"], []);
    if (Object.keys(context).length === 0) fail(path, "requires at least one relevance list");
    const lists: [string, Set<string>, string, number][] = [
      ["origins", originIds, "origin", 256], ["jobs", jobIds, "job", 128], ["activities", resourceActivityIds, "activity", 1_000],
    ];
    for (const [field, known, kind, maximum] of lists) {
      if (!Object.hasOwn(context, field)) continue;
      const values = array(context[field], `${path}.${field}`, 1, maximum);
      const seen = new Set<string>();
      values.forEach((value, j) => {
        const location = `${path}.${field}[${j}]`;
        reference(value, location, known, kind);
        if (seen.has(value as string)) fail(location, `duplicate ${kind} reference`);
        seen.add(value as string);
      });
    }
  });

  const originWeights: number[] = [];
  origins.forEach((entry, i) => {
    const path = `world.origins[${i}]`;
    const origin = object(entry, path, ["id", "title", "text", "weight", "effects", "sourceIds", "evidence", "statRanges", "assetRanges"], ["id", "title", "text", "weight", "effects"]);
    string(origin.title, `${path}.title`, 300);
    string(origin.text, `${path}.text`);
    originWeights.push(weight(origin.weight, `${path}.weight`));
    if (Object.hasOwn(origin, "statRanges")) {
      const ranges = object(origin.statRanges, `${path}.statRanges`);
      for (const [key, range] of Object.entries(ranges)) {
        reference(key, `${path}.statRanges.${key}`, statIds, "stat");
        statRange(range, `${path}.statRanges.${key}`, stats[key] as DataObject);
      }
    }
    if (Object.hasOwn(origin, "assetRanges")) {
      requireEconomy(`${path}.assetRanges`);
      const ranges = object(origin.assetRanges, `${path}.assetRanges`);
      for (const [key, range] of Object.entries(ranges)) {
        reference(key, `${path}.assetRanges.${key}`, assetIds, "asset");
        assetRange(range, `${path}.assetRanges.${key}`);
      }
      let maximumValue = 0, maximumIncome = 0;
      for (const asset of assets as DataObject[]) {
        const range = ranges[asset.id as string] ?? asset.initialRange;
        const maximum = range ? (range as DataObject).max as number : 0;
        if (!economy!.uncappedResources && asset.maxOwned !== undefined && maximum > (asset.maxOwned as number)) fail(`${path}.assetRanges.${asset.id}`, "starting quantity must not exceed the legacy ownership limit");
        maximumValue += (asset.value as number) * maximum;
        maximumIncome += ((asset.yearlyIncome as number | undefined) ?? 0) * maximum;
      }
      if (maximumValue > moneyLimit || maximumIncome > moneyLimit) fail(`${path}.assetRanges`, "combined starting asset value and annual income must each stay within 1000000000000");
    }
    effects(origin.effects, `${path}.effects`);
    if ((origin.effects as DataObject[]).some(effect => ["cash", "debt", "asset", "loan"].includes(effect.type as string))) fail(`${path}.effects`, "origin money is derived from its starting economy stat; use finance effects in events and activities");
    evidence(origin, path);
  });
  aggregate(originWeights, "world.origins");
  effects(world.yearlyEffects, "world.yearlyEffects");
  if ((world.yearlyEffects as DataObject[]).some(effect => effect.type === "loan")) fail("world.yearlyEffects", "loan actions require an explicit player choice or activity");
  if (Object.hasOwn(world, "yearlyRules")) {
    const rules = array(world.yearlyRules, "world.yearlyRules", 0, 128);
    unique(rules, "world.yearlyRules");
    rules.forEach((entry, i) => {
      const path = `world.yearlyRules[${i}]`;
      const rule = object(entry, path, ["id", "when", "effects"], ["id", "effects"]);
      if (Object.hasOwn(rule, "when")) condition(rule.when, `${path}.when`);
      effects(rule.effects, `${path}.effects`);
      if ((rule.effects as DataObject[]).some(effect => effect.type === "loan")) fail(`${path}.effects`, "loan actions require an explicit player choice or activity");
    });
  }
  const randomWeights: number[] = [];
  const hasDemoCondition = (rule: unknown): boolean => {
    if (rule === null || typeof rule !== "object") return false;
    const data = rule as DataObject;
    if (data.type === "demo") return true;
    if (data.type === "not") return hasDemoCondition(data.condition);
    return (data.type === "all" || data.type === "any") && Array.isArray(data.conditions) && data.conditions.some(hasDemoCondition);
  };
  const exclusiveGroupAges = new Map<string, number>();
  const stageTools: LifeStageValidationTools = { fail, object, array, string, id, integer,
    condition: (value, path) => condition(value, path), effects: (value, path) => effects(value, path) };
  const stageRules = Object.hasOwn(world, "lifeStages") ? validateLifeStagesDefinition(world.lifeStages, maxAge, stageTools) : undefined;
  const hasPaths = Object.hasOwn(world, "paths");
  if (hasPaths) validatePathsDefinition(world.paths, Boolean(stageRules), { ...stageTools, skills: skillIds, jobs: jobIds, origins: originIds });
  const eventDefinition = (entry: unknown, path: string): void => {
    const event = object(entry, path, ["id", "title", "text", "trigger", "when", "maxOccurrences", "cooldownYears", "rarity", "exclusiveGroup", "choices", "mode", "effects", "sourceIds", "evidence", "stages", "scope", "dependent", "fields"], ["id", "title", "text", "trigger", "choices"]);
    string(event.title, `${path}.title`, 300);
    string(event.text, `${path}.text`);
    evidence(event, path);
    if (Object.hasOwn(event, "mode") && event.mode !== "automatic") fail(`${path}.mode`, "only automatic mode is supported");
    if (Object.hasOwn(event, "effects")) {
      if (event.mode !== "automatic") fail(`${path}.effects`, "event effects require automatic mode");
      effects(event.effects, `${path}.effects`);
      if ((event.effects as DataObject[]).some(effect => effect.type === "loan")) fail(`${path}.effects`, "loan actions require an explicit player choice or activity");
    }
    if (Object.hasOwn(event, "when")) condition(event.when, `${path}.when`);
    const trigger = object(event.trigger, `${path}.trigger`, undefined, ["type"]);
    if (trigger.type === "random") {
      object(trigger, `${path}.trigger`, ["type", "weight"]);
      randomWeights.push(weight(trigger.weight, `${path}.trigger.weight`));
    } else if (trigger.type === "age") {
      object(trigger, `${path}.trigger`, ["type", "at"]);
      integer(trigger.at, `${path}.trigger.at`, 0, maxAge);
    } else if (trigger.type === "year") {
      object(trigger, `${path}.trigger`, ["type", "at"]);
      const at = year(trigger.at, `${path}.trigger.at`);
      if (at < startYear || at > lastYear) fail(`${path}.trigger.at`, "scheduled year is outside this life's calendar range");
    } else fail(`${path}.trigger.type`, "unknown event trigger type");
    if (Object.hasOwn(event, "exclusiveGroup")) {
      const group = id(event.exclusiveGroup, `${path}.exclusiveGroup`);
      if (trigger.type !== "age" || event.mode === "automatic" || Object.hasOwn(event, "rarity")) fail(`${path}.exclusiveGroup`, "exclusive groups require age-trigger decision events");
      if (event.id === health?.careDecision || moneylender && Object.values(moneylender.events as DataObject).includes(event.id)) fail(`${path}.exclusiveGroup`, "medical and collection interrupts cannot be grouped");
      const at = trigger.at as number;
      if (exclusiveGroupAges.has(group) && exclusiveGroupAges.get(group) !== at) fail(`${path}.exclusiveGroup`, "all events in an exclusive group must use the same trigger age");
      exclusiveGroupAges.set(group, at);
    }
    if (Object.hasOwn(event, "rarity")) {
      if (event.rarity !== "rare") fail(`${path}.rarity`, "only rare rarity is supported");
      if (trigger.type !== "random" || event.mode === "automatic") fail(`${path}.rarity`, "rare encounters require random-trigger decision events");
      if (event.id === health?.careDecision || moneylender && Object.values(moneylender.events as DataObject).includes(event.id)) fail(`${path}.rarity`, "medical and collection interrupts cannot be rare encounters");
    }
    if (Object.hasOwn(event, "maxOccurrences")) {
      const count = integer(event.maxOccurrences, `${path}.maxOccurrences`, 1, Number.MAX_SAFE_INTEGER);
      // Demo worlds: a year-anchored decision gated by a demo condition (e.g. a fresh low flood) recurs once per episode.
      const demoAnchor = Object.hasOwn(world, "demo") && trigger.type === "year" && hasDemoCondition(event.when);
      if (trigger.type !== "random" && count !== 1 && !demoAnchor) fail(`${path}.maxOccurrences`, "scheduled events permit maxOccurrences of 1 only");
    }
    if (Object.hasOwn(event, "cooldownYears")) integer(event.cooldownYears, `${path}.cooldownYears`, 0, Number.MAX_SAFE_INTEGER);
    const choices = array(event.choices, `${path}.choices`, event.mode === "automatic" ? 0 : 1, 32);
    if (event.mode === "automatic" && choices.length > 0) fail(`${path}.choices`, "automatic events must have an empty choice list");
    unique(choices, `${path}.choices`);
    choices.forEach((choiceEntry, j) => {
      const choicePath = `${path}.choices[${j}]`;
      const choice = object(choiceEntry, choicePath, ["id", "text", "when", "outcomes", "opportunity"], ["id", "text", "outcomes"]);
      string(choice.text, `${choicePath}.text`);
      if (Object.hasOwn(choice, "when")) condition(choice.when, `${choicePath}.when`);
      const outcomes = array(choice.outcomes, `${choicePath}.outcomes`, 1, 64);
      unique(outcomes, `${choicePath}.outcomes`);
      const outcomeWeights = outcomes.map((entry, k) => outcomeDefinition(entry, `${choicePath}.outcomes[${k}]`, event.rarity === "rare"));
      aggregate(outcomeWeights, `${choicePath}.outcomes`);
      opportunityDefinition(choice, choicePath, outcomes);
    });
    const interrupt = event.id === health?.careDecision ? "medical" as const
      : moneylender && Object.values(moneylender.events as DataObject).includes(event.id) ? "collection" as const : undefined;
    validateStagedEvent(event, path, stageRules, { interrupt }, stageTools);
    validateEventFields(event, path, hasPaths, stageTools);
  };
  events.forEach((entry, i) => eventDefinition(entry, `world.events[${i}]`));
  if (Object.hasOwn(world, "influences")) {
    // Entry IDs are catalog action IDs such as `letters.teach`; their events share the world's event namespace.
    const influenceIds = new Set<string>();
    const catalogEventIds = new Set(eventIds);
    array(world.influences, "world.influences", 0, 1_000).forEach((value, i) => {
      const path = `world.influences[${i}]`;
      const entry = object(value, path, ["id", "label", "baseWeight", "effects", "event"], ["id", "label", "baseWeight"]);
      const key = string(entry.id, `${path}.id`, 100);
      if (!INFLUENCE_ID.test(key) || BAD_KEYS.has(key)) fail(`${path}.id`, "expected a lowercase dotted ID such as 'letters.teach'");
      if (influenceIds.has(key)) fail(`${path}.id`, `duplicate ID '${key}'`);
      influenceIds.add(key);
      string(entry.label, `${path}.label`, 300);
      if (entry.baseWeight !== 1 && entry.baseWeight !== 3 && entry.baseWeight !== 5) fail(`${path}.baseWeight`, "expected 1, 3 or 5");
      if (!Object.hasOwn(entry, "effects") && !Object.hasOwn(entry, "event")) fail(path, "an influence entry needs effects or an event");
      if (Object.hasOwn(entry, "effects")) {
        demoGrainGain = true;
        effects(entry.effects, `${path}.effects`);
        demoGrainGain = false;
        if ((entry.effects as DataObject[]).some(effect => effect.type === "loan")) fail(`${path}.effects`, "loan actions require an explicit player choice or activity");
      }
      if (!Object.hasOwn(entry, "event")) return;
      const event = object(entry.event, `${path}.event`, undefined, ["id"]);
      const eventId = id(event.id, `${path}.event.id`);
      if (catalogEventIds.has(eventId)) fail(`${path}.event.id`, `duplicate event ID '${eventId}'`);
      catalogEventIds.add(eventId);
      if (Object.hasOwn(event, "exclusiveGroup")) fail(`${path}.event.exclusiveGroup`, "influence events cannot join exclusive groups");
      // Influence events are deeds too: they may bring grain into the store.
      demoGrainGain = true;
      eventDefinition(event, `${path}.event`);
      demoGrainGain = false;
    });
  }
  aggregate(randomWeights, "world.events");
  if (moneylender) {
    const path = "world.economy.moneylender.events";
    const links = moneylender.events as DataObject;
    const selected = [links.due, links.threat, links.attack];
    if (new Set(selected).size !== selected.length) fail(path, "collection events must use three distinct IDs");
    for (const stage of ["due", "threat", "attack"]) {
      reference(links[stage], `${path}.${stage}`, eventIds, "event");
      const event = events.find(entry => (entry as DataObject).id === links[stage]) as DataObject;
      if (event.mode === "automatic" || (event.trigger as DataObject).type !== "random") fail(`${path}.${stage}`, "collection interrupts require a random-trigger decision event");
      if (health?.careDecision === event.id) fail(`${path}.${stage}`, "collection and medical interrupts must use different events");
      const hasFallback = (event.choices as DataObject[]).some(choice => !Object.hasOwn(choice, "when") &&
        (choice.outcomes as DataObject[]).every(outcome => !(outcome.effects as DataObject[]).some(effect => effect.type === "loan")));
      if (!hasFallback) fail(`${path}.${stage}`, "collection decisions require an unconditional option without loan effects");
    }
  }
  endings.forEach((entry, i) => {
    const path = `world.endings[${i}]`;
    const ending = object(entry, path, ["id", "title", "text", "when", "kind", "sourceIds", "evidence"], ["id", "title", "text"]);
    string(ending.title, `${path}.title`, 300);
    string(ending.text, `${path}.text`);
    evidence(ending, path);
    if (Object.hasOwn(ending, "kind") && ending.kind !== "death" && ending.kind !== "chapter") fail(`${path}.kind`, "unknown ending kind");
    if (Object.hasOwn(ending, "when")) condition(ending.when, `${path}.when`);
    if (health && ending.kind === "death" && Object.hasOwn(ending, "when")) fail(`${path}.when`, "health-driven deaths must come from a recorded condition or explicit end effect");
  });
  if (relationships) {
    requireCharacter("world.relationships");
    string(relationships.description, "world.relationships.description");
    for (const key of ["initialCloseness", "childCloseness", "yearlyDecay", "marriageMinimum", "supportThreshold"]) integer(relationships[key], `world.relationships.${key}`, 0, 100);
    integer(relationships.decayAfterYears, "world.relationships.decayAfterYears", 0, 100);
    const support = number(relationships.maxHealthSupport, "world.relationships.maxHealthSupport");
    if (support < 0 || support > 1) fail("world.relationships.maxHealthSupport", "expected support in 0..1");
  }
  if (health) {
    requireCharacter("world.health");
    string(health.description, "world.health.description");
    sourceReferences(health.sourceIds, "world.health.sourceIds");
    reference(health.stat, "world.health.stat", statIds, "stat");
    const healthStat = stats[health.stat as string] as DataObject;
    if (economy && economy.stat === health.stat) fail("world.health.stat", "health cannot use the economy stat");
    const critical = number(health.criticalHealth, "world.health.criticalHealth");
    if (critical < (healthStat.min as number) || critical > (healthStat.max as number)) fail("world.health.criticalHealth", "must be within health stat bounds");
    reference(health.declineCondition, "world.health.declineCondition", healthConditionIds, "health condition");
    const decline = healthConditions.find(entry => (entry as DataObject).id === health.declineCondition) as DataObject;
    if (decline.kind !== "frailty" || decline.weight !== 0) fail("world.health.declineCondition", "critical health requires an explicit-only frailty condition");
    reference(health.careDecision, "world.health.careDecision", eventIds, "event");
    const careEvent = events.find(entry => (entry as DataObject).id === health.careDecision) as DataObject;
    if (careEvent.mode === "automatic" || !(careEvent.choices as DataObject[]).some(choice => !choice.when)) fail("world.health.careDecision", "requires a decision with at least one unconditional option");
    if (!(endings.some(entry => (entry as DataObject).kind === "death"))) fail("world.health", "requires at least one death ending");
    if (!(endings.some(entry => (entry as DataObject).id === world.defaultEnding && (entry as DataObject).kind === "chapter"))) fail("world.defaultEnding", "health worlds require a non-death administrative cap ending");
    const support = number(health.supportRecoveryBonus, "world.health.supportRecoveryBonus");
    if (support < 0 || support > 1) fail("world.health.supportRecoveryBonus", "expected recovery support in 0..1");
    const checkHealthBands = (value: unknown, field: string, probability: boolean): void => {
      const bands = array(value, `world.health.${field}`, 1, 128);
      let nextAge = 0;
      bands.forEach((entry, i) => {
        const path = `world.health.${field}[${i}]`;
        const key = probability ? "annualProbability" : "healthLoss";
        const band = object(entry, path, ["minAge", "maxAge", key]);
        const min = integer(band.minAge, `${path}.minAge`, 0, maxAge - 1);
        const max = integer(band.maxAge, `${path}.maxAge`, min, maxAge - 1);
        if (min !== nextAge) fail(`${path}.minAge`, "health bands must be ordered and contiguous from age zero");
        nextAge = max + 1;
        const amount = number(band[key], `${path}.${key}`);
        if (amount < 0 || amount > (probability ? 1 : (healthStat.max as number) - (healthStat.min as number))) fail(`${path}.${key}`, "value is outside its allowed range");
      });
      if (nextAge !== maxAge) fail(`world.health.${field}`, "health bands must cover every age below maxAge");
    };
    checkHealthBands(health.incidenceBands, "incidenceBands", true);
    checkHealthBands(health.declineBands, "declineBands", false);
    let totalIncidentWeight = 0;
    healthConditions.forEach((entry, i) => {
      const path = `world.health.conditions[${i}]`;
      const definition = object(entry, path, ["id", "title", "deathCause", "kind", "weight", "when", "healthLoss", "recoveryChance", "careRecoveryBonus", "fatalHealthThreshold"], ["id", "title", "deathCause", "kind", "weight", "healthLoss", "recoveryChance", "careRecoveryBonus", "fatalHealthThreshold"]);
      string(definition.title, `${path}.title`, 300);
      reference(definition.deathCause, `${path}.deathCause`, deathCauseIds, "death cause");
      if (!["illness", "injury", "frailty"].includes(definition.kind as string)) fail(`${path}.kind`, "unknown health condition kind");
      const loss = number(definition.healthLoss, `${path}.healthLoss`);
      if (loss < 0 || loss > (healthStat.max as number) - (healthStat.min as number)) fail(`${path}.healthLoss`, "must be within the health stat span");
      const incidentWeight = number(definition.weight, `${path}.weight`);
      if (incidentWeight < 0 || incidentWeight > Number.MAX_SAFE_INTEGER) fail(`${path}.weight`, "expected a nonnegative finite weight");
      totalIncidentWeight += incidentWeight;
      for (const key of ["recoveryChance", "careRecoveryBonus"]) {
        const chance = number(definition[key], `${path}.${key}`);
        if (chance < 0 || chance > 1) fail(`${path}.${key}`, "expected a probability in 0..1");
      }
      const fatal = number(definition.fatalHealthThreshold, `${path}.fatalHealthThreshold`);
      if (fatal < (healthStat.min as number) || fatal > critical) fail(`${path}.fatalHealthThreshold`, "must be between minimum and critical health");
      if (Object.hasOwn(definition, "when")) condition(definition.when, `${path}.when`);
    });
    if (!Number.isFinite(totalIncidentWeight) || totalIncidentWeight > Number.MAX_SAFE_INTEGER) fail("world.health.conditions", "combined weights exceed Number.MAX_SAFE_INTEGER");
  }
  if (Object.hasOwn(world, "mortality")) {
    const model = object(world.mortality, "world.mortality", ["description", "sourceIds", "bands"]);
    string(model.description, "world.mortality.description");
    sourceReferences(model.sourceIds, "world.mortality.sourceIds");
    const deathIds = new Set(endings.filter(entry => (entry as DataObject).kind === "death").map(entry => (entry as DataObject).id as string));
    if (!health && !deathIds.has(world.defaultEnding as string)) fail("world.defaultEnding", "a mortality-enabled world requires a death ending at maximum age");
    const bands = array(model.bands, "world.mortality.bands", 1, 128);
    let nextAge = 0;
    bands.forEach((entry, i) => {
      const path = `world.mortality.bands[${i}]`;
      const band = object(entry, path, ["minAge", "maxAge", "annualProbability", "ending"]);
      const min = integer(band.minAge, `${path}.minAge`, 0, maxAge - 1);
      const max = integer(band.maxAge, `${path}.maxAge`, min, maxAge - 1);
      if (min !== nextAge) fail(`${path}.minAge`, "mortality bands must be ordered and contiguous from age zero");
      nextAge = max + 1;
      const probability = number(band.annualProbability, `${path}.annualProbability`);
      if (probability < 0 || probability > 1) fail(`${path}.annualProbability`, "expected a probability in 0..1");
      reference(band.ending, `${path}.ending`, deathIds, "death ending");
    });
    if (nextAge !== maxAge) fail("world.mortality.bands", "mortality bands must cover every age below maxAge");
  }
  if (health && Object.hasOwn(health, "mortalityCalibration")) {
    const path = "world.health.mortalityCalibration";
    const requiredCalibration = ["minAge", "referenceHealth", "referenceCare", "caseFatality", "onsetHealth", "convalescenceLoss", "healthInfluence", "careInfluence"];
    const calibration = object(health.mortalityCalibration, path, [...requiredCalibration, "onsetLoss", "lingerYears", "lingerLoss", "lingerRecovery"], requiredCalibration);
    const minAge = integer(calibration.minAge, `${path}.minAge`, 0, maxAge - 1);
    const healthStat = stats[health.stat as string] as DataObject;
    const min = healthStat.min as number, max = healthStat.max as number;
    if (!(max > min) || !Number.isFinite(max - min)) fail(path, "requires a finite positive Health span");
    const reference = number(calibration.referenceHealth, `${path}.referenceHealth`);
    if (reference < min || reference > max) fail(`${path}.referenceHealth`, "must be within Health bounds");
    const onset = number(calibration.onsetHealth, `${path}.onsetHealth`);
    if (onset < min || onset > (health.criticalHealth as number)) fail(`${path}.onsetHealth`, "must be between minimum and critical Health");
    if (healthConditions.some(entry => ((entry as DataObject).fatalHealthThreshold as number) > onset)) fail(`${path}.onsetHealth`, "must be at least every condition's fatal Health threshold");
    const convalescence = number(calibration.convalescenceLoss, `${path}.convalescenceLoss`);
    if (convalescence < 0 || convalescence > max - min) fail(`${path}.convalescenceLoss`, "must be within the Health span");
    for (const key of ["referenceCare", "healthInfluence", "careInfluence"]) {
      const value = number(calibration[key], `${path}.${key}`);
      if (value < 0 || value > 1) fail(`${path}.${key}`, "expected a value in 0..1");
    }
    if (1 - (calibration.careInfluence as number) * (calibration.referenceCare as number) <= 0) fail(`${path}.referenceCare`, "reference care denominator must remain positive");
    if (Object.hasOwn(calibration, "onsetLoss") && number(calibration.onsetLoss, `${path}.onsetLoss`) < 0) fail(`${path}.onsetLoss`, "must not be negative");
    if (Object.hasOwn(calibration, "lingerYears")) integer(calibration.lingerYears, `${path}.lingerYears`, 0, maxAge);
    if (Object.hasOwn(calibration, "lingerLoss") && number(calibration.lingerLoss, `${path}.lingerLoss`) < 0) fail(`${path}.lingerLoss`, "must not be negative");
    if (Object.hasOwn(calibration, "lingerRecovery")) {
      const share = number(calibration.lingerRecovery, `${path}.lingerRecovery`);
      if (share < 0 || share > 1) fail(`${path}.lingerRecovery`, "expected a share in 0..1");
    }
    const fatality = number(calibration.caseFatality, `${path}.caseFatality`);
    if (fatality <= 0 || fatality > 1) fail(`${path}.caseFatality`, "expected a case fatality in (0, 1]");
    if (!Object.hasOwn(world, "mortality")) fail(path, "requires mortality reference bands");
    const bands = (world.mortality as DataObject).bands as DataObject[];
    if (bands.some(band => (band.maxAge as number) >= minAge && (band.annualProbability as number) > fatality)) fail(`${path}.caseFatality`, "must cover the greatest calibrated annual mortality probability");
    if (!healthConditions.some(entry => {
      const condition = entry as DataObject;
      return condition.kind === "illness" && (condition.weight as number) > 0 && !Object.hasOwn(condition, "when");
    })) fail(path, "requires an unconditional positive-weight illness fallback");
  }
  if (Object.hasOwn(world, "demo")) {
    const character = (world.character ?? {}) as DataObject;
    const legacy = (world.legacy ?? {}) as DataObject;
    const listIds = (list: unknown) => new Set(Array.isArray(list) ? list.map(item => (item as DataObject).id as string) : []);
    validateDemoDefinition(world.demo, fail, { origins: originIds, jobs: listIds(character.jobs), activities: listIds(character.activities),
      skills: new Set(Object.keys((character.skills ?? {}) as DataObject)), achievements: listIds(legacy.achievements) });
    if (!Object.hasOwn(world, "economy") || !Object.hasOwn(world, "character")) fail("world.demo", "requires an economy and characters");
  }
}
