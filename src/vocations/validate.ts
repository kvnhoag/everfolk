import type { VocationDefinition } from "./types.ts";
/** Strict, bounded JSON rules. All ids are local to this immutable pack. */
export function validateVocations(input: unknown, skills: Set<string>, fail: (path: string, message: string) => never): asserts input is VocationDefinition {
  const path = "world.vocations";
  function obj(v: unknown, p: string, fields?: string[], required = fields): Record<string, any> {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) fail(p, "expected plain object");
    for (const key of Reflect.ownKeys(v as object)) {
      if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key) || fields && !fields.includes(key)) fail(p, "unknown or reserved field");
      const d = Object.getOwnPropertyDescriptor(v, key)!;
      if (!("value" in d) || !d.enumerable) fail(p, "expected JSON data");
    }
    if (required) for (const key of required) if (!Object.hasOwn(v as object, key)) fail(`${p}.${key}`, "required field");
    return v as Record<string, any>;
  }
  const n = (v: unknown, p: string, min = 0, max = 1000000): void => { if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) fail(p, `expected integer ${min}..${max}`); };
  const map = (v: unknown, p: string): Record<string, any> => {
    const o = obj(v, p); if (Object.keys(o).length > 256) fail(p, "too many entries");
    for (const k of Object.keys(o)) if (!/^[a-z][a-z0-9-]*$/.test(k)) fail(p, "invalid id");
    return o;
  };
  const root = obj(input, path, ["materials", "recipes", "actions", "accounts", "demand"]);
  const materials = map(root.materials, path + ".materials"), recipes = map(root.recipes, path + ".recipes");
  for (const [id, value] of Object.entries(materials)) {
    const m = obj(value, `${path}.materials.${id}`, ["price", "stock"]); n(m.price, path, 1, 10000); n(m.stock, path, 0, 100000);
  }
  const outputs = new Set<string>();
  const mapping = (value: unknown, known: Set<string>, min: number, max: number): void => { for (const [k, v] of Object.entries(map(value, path))) { if (!known.has(k)) fail(path, `unknown reference ${k}`); n(v, path, min, max); } };
  const training = (value: Record<string, any>): void => {
    const supports = value.supports;
    if (!Array.isArray(supports) || Object.getPrototypeOf(supports) !== Array.prototype || supports.length > 2) fail(path, "invalid primary/support skills");
    for (let i = 0; i < supports.length; i++) if (!Object.hasOwn(supports, i)) fail(path, "expected dense JSON support array");
    // Inspect descriptors before iterating: executable getters are not pack data.
    for (const key of Reflect.ownKeys(supports)) {
      const descriptor = Object.getOwnPropertyDescriptor(supports, key)!;
      if (!("value" in descriptor) || key !== "length" && !/^[0-1]$/.test(String(key))) fail(path, "expected JSON support array");
    }
    if (typeof value.primary !== "string" || !skills.has(value.primary) || supports.some((s: unknown) => typeof s !== "string" || !skills.has(s)) || new Set([value.primary, ...supports]).size !== supports.length + 1) fail(path, "invalid primary/support skills");
  };
  for (const value of Object.values(recipes)) {
    const r = obj(value, path, ["title", "inputs", "output", "outputQuantity", "fee", "workYears", "skills", "primary", "supports", "baseAsk"]);
    if (typeof r.title !== "string" || !r.title.length || r.title.length > 200 || typeof r.output !== "string" || !/^[a-z][a-z0-9-]*$/.test(r.output) || outputs.has(r.output)) fail(path, "invalid or duplicate recipe output");
    outputs.add(r.output); n(r.outputQuantity, path, 1, 1000); n(r.fee, path, 0, 10000); n(r.workYears, path, 1, 10); n(r.baseAsk, path, 1, 10000); mapping(r.skills, skills, 0, 100); training(r);
  }
  const items = new Set([...Object.keys(materials), ...outputs]);
  for (const value of Object.values(recipes)) mapping(value.inputs, items, 1, 1000);
  const accounts = obj(root.accounts, path, ["merchant", "workshop", "school", "council"]);
  for (const value of Object.values(accounts)) n(value, path);
  mapping(root.demand, outputs, 0, 10000);
  for (const value of Object.values(map(root.actions, path + ".actions"))) {
    const a = obj(value, path);
    if (a.kind === "buy") { obj(a, path, ["kind", "item", "quantity"]); if (typeof a.item !== "string" || !Object.hasOwn(materials, a.item)) fail(path, "unknown material"); n(a.quantity, path, 1, 1000); }
    else if (a.kind === "sell") { obj(a, path, ["kind", "item"]); if (!outputs.has(a.item)) fail(path, "unknown product"); }
    else if (a.kind === "make") {
      obj(a, path, ["kind", "recipe", "quantity", "inspected", "controlledFiring"], ["kind", "recipe"]);
      if (typeof a.recipe !== "string" || !Object.hasOwn(recipes, a.recipe)) fail(path, "unknown recipe");
      if (a.quantity !== undefined) n(a.quantity, path, 1, 16);
      for (const field of ["inspected", "controlledFiring"]) if (a[field] !== undefined && typeof a[field] !== "boolean") fail(path, "expected boolean production option");
    }
    else if (a.kind === "work") {
      obj(a, path, ["kind", "fee", "pay", "payer", "primary", "supports", "practice"]); training(a); n(a.fee, path, 0, 10000); n(a.pay, path, 0, 10000);
      if (!["workshop", "school", "council"].includes(a.payer) || typeof a.practice !== "boolean") fail(path, "invalid work account/practice");
    } else fail(path, "unknown action kind");
  }
}
