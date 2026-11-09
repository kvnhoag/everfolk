import type { WorldPack } from "./types.ts";

type DataObject = Record<string, unknown>;
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ID = /^[a-z][a-z0-9-]*$/;
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

  const world = object(input, "world", [
    "schemaVersion", "id", "version", "title", "description", "startYear", "maxAge",
    "stats", "flags", "origins", "yearlyEffects", "events", "endings", "defaultEnding",
  ]);
  if (world.schemaVersion !== 1) fail("world.schemaVersion", "only schema version 1 is supported");
  id(world.id, "world.id");
  string(world.version, "world.version", 100);
  string(world.title, "world.title", 300);
  string(world.description, "world.description");
  const startYear = year(world.startYear, "world.startYear");
  const maxAge = integer(world.maxAge, "world.maxAge", 1, 10_000);
  const lastAstronomicalYear = (startYear < 0 ? startYear + 1 : startYear) + maxAge;
  const lastYear = lastAstronomicalYear <= 0 ? lastAstronomicalYear - 1 : lastAstronomicalYear;
  if (!Number.isSafeInteger(lastAstronomicalYear) || !Number.isSafeInteger(lastYear)) {
    fail("world.startYear", "calendar range through maxAge must remain a safe integer");
  }

  const stats = object(world.stats, "world.stats");
  const statIds = new Set(Object.keys(stats));
  if (statIds.size < 1 || statIds.size > 128) fail("world.stats", "expected 1..128 stat definitions");
  for (const [key, value] of Object.entries(stats)) {
    id(key, `world.stats.${key}`);
    const path = `world.stats.${key}`;
    const definition = object(value, path, ["label", "min", "max", "initial"]);
    string(definition.label, `${path}.label`, 300);
    const min = number(definition.min, `${path}.min`);
    const max = number(definition.max, `${path}.max`);
    const initial = number(definition.initial, `${path}.initial`);
    if (min >= max) fail(path, "min must be less than max");
    if (initial < min || initial > max) fail(`${path}.initial`, "must be within stat bounds");
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
  unique(events, "world.events");
  const endings = array(world.endings, "world.endings", 1, 256);
  const endingIds = unique(endings, "world.endings");
  reference(world.defaultEnding, "world.defaultEnding", endingIds, "ending");

  const condition = (value: unknown, path: string, depth = 0): void => {
    if (depth > 32) fail(path, "condition nesting exceeds 32 levels");
    const rule = object(value, path, undefined, ["type"]);
    switch (rule.type) {
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
      case "all":
      case "any":
        object(rule, path, ["type", "conditions"]);
        array(rule.conditions, `${path}.conditions`, 1, 256).forEach((entry, i) => condition(entry, `${path}.conditions[${i}]`, depth + 1));
        break;
      case "not":
        object(rule, path, ["type", "condition"]);
        condition(rule.condition, `${path}.condition`, depth + 1);
        break;
      default:
        fail(`${path}.type`, "unknown condition type");
    }
  };
  const effects = (value: unknown, path: string): void => {
    array(value, path, 0, 128).forEach((entry, i) => {
      const location = `${path}[${i}]`;
      const effect = object(entry, location, undefined, ["type"]);
      switch (effect.type) {
        case "stat":
          object(effect, location, ["type", "stat", "delta"]);
          reference(effect.stat, `${location}.stat`, statIds, "stat");
          number(effect.delta, `${location}.delta`);
          break;
        case "flag":
          object(effect, location, ["type", "flag", "value"]);
          reference(effect.flag, `${location}.flag`, flagIds, "flag");
          bool(effect.value, `${location}.value`);
          break;
        case "end":
          object(effect, location, ["type", "ending"]);
          reference(effect.ending, `${location}.ending`, endingIds, "ending");
          break;
        default:
          fail(`${location}.type`, "unknown effect type");
      }
    });
  };

  const originWeights: number[] = [];
  origins.forEach((entry, i) => {
    const path = `world.origins[${i}]`;
    const origin = object(entry, path, ["id", "title", "text", "weight", "effects"]);
    string(origin.title, `${path}.title`, 300);
    string(origin.text, `${path}.text`);
    originWeights.push(weight(origin.weight, `${path}.weight`));
    effects(origin.effects, `${path}.effects`);
  });
  aggregate(originWeights, "world.origins");
  effects(world.yearlyEffects, "world.yearlyEffects");
  const randomWeights: number[] = [];
  events.forEach((entry, i) => {
    const path = `world.events[${i}]`;
    const event = object(entry, path, ["id", "title", "text", "trigger", "when", "maxOccurrences", "cooldownYears", "choices"], ["id", "title", "text", "trigger", "choices"]);
    string(event.title, `${path}.title`, 300);
    string(event.text, `${path}.text`);
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
    if (Object.hasOwn(event, "maxOccurrences")) {
      const count = integer(event.maxOccurrences, `${path}.maxOccurrences`, 1, Number.MAX_SAFE_INTEGER);
      if (trigger.type !== "random" && count !== 1) fail(`${path}.maxOccurrences`, "scheduled events permit maxOccurrences of 1 only");
    }
    if (Object.hasOwn(event, "cooldownYears")) integer(event.cooldownYears, `${path}.cooldownYears`, 0, Number.MAX_SAFE_INTEGER);
    const choices = array(event.choices, `${path}.choices`, 1, 32);
    unique(choices, `${path}.choices`);
    choices.forEach((choiceEntry, j) => {
      const choicePath = `${path}.choices[${j}]`;
      const choice = object(choiceEntry, choicePath, ["id", "text", "when", "outcomes"], ["id", "text", "outcomes"]);
      string(choice.text, `${choicePath}.text`);
      if (Object.hasOwn(choice, "when")) condition(choice.when, `${choicePath}.when`);
      const outcomes = array(choice.outcomes, `${choicePath}.outcomes`, 1, 64);
      unique(outcomes, `${choicePath}.outcomes`);
      const outcomeWeights: number[] = [];
      outcomes.forEach((outcomeEntry, k) => {
        const outcomePath = `${choicePath}.outcomes[${k}]`;
        const outcome = object(outcomeEntry, outcomePath, ["id", "text", "weight", "effects"]);
        string(outcome.text, `${outcomePath}.text`);
        outcomeWeights.push(weight(outcome.weight, `${outcomePath}.weight`));
        effects(outcome.effects, `${outcomePath}.effects`);
      });
      aggregate(outcomeWeights, `${choicePath}.outcomes`);
    });
  });
  aggregate(randomWeights, "world.events");
  endings.forEach((entry, i) => {
    const path = `world.endings[${i}]`;
    const ending = object(entry, path, ["id", "title", "text", "when"], ["id", "title", "text"]);
    string(ending.title, `${path}.title`, 300);
    string(ending.text, `${path}.text`);
    if (Object.hasOwn(ending, "when")) condition(ending.when, `${path}.when`);
  });
}
