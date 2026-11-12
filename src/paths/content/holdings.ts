/**
 * Holdings: what the household actually has opens a direction. These events never create money
 * or goods; they consume or move goods with a recorded cause and change skills, affinity or standing.
 */
import type { Choice, Condition, Effect, LifeEvent } from "../../types.ts";
import type { DecisionScope } from "../../life-stages/types.ts";
import type { FieldId } from "../types.ts";

type Op = "gte" | "lte";
const holds = (item: string, value: number, op: Op = "gte"): Condition => ({ type: "demo", condition: { kind: "item", item, op, value } } as Condition);
const material = (item: string, value: number): Condition => ({ type: "material", item, op: "gte", value });
const any = (...conditions: Condition[]): Condition => ({ type: "any", conditions });
const all = (...conditions: Condition[]): Condition => ({ type: "all", conditions });
const pull = (field: FieldId, delta: number, source: string): Effect => ({ type: "affinity", field, delta, source });
const skill = (id: string, delta: number): Effect => ({ type: "skill", skill: id, delta });
const stat = (id: string, delta: number): Effect => ({ type: "stat", stat: id, delta });
const demo = (effect: Record<string, unknown>): Effect => ({ type: "demo", effect } as Effect);
const use = (item: string, quantity: number, cause: string): Effect => ({ type: "use-material", item, quantity, cause });

const WORK_YEARS = ["adolescence", "youth", "adulthood"];
const HOUSEHOLD_YEARS = ["adulthood", "later-life"];

interface Spec {
  id: string; title: string; text: string; when: Condition; stages: string[]; fields: FieldId[];
  scope?: DecisionScope; effects?: Effect[];
  choices?: Array<{ key: string; text: string; result: string; effects: Effect[]; when?: Condition }>;
  max?: number; cooldown?: number;
}

function build(spec: Spec): LifeEvent {
  const base = { id: spec.id, title: spec.title, text: spec.text, trigger: { type: "random" as const, weight: 1 }, when: spec.when,
    stages: spec.stages, fields: spec.fields, maxOccurrences: spec.max ?? 2, cooldownYears: spec.cooldown ?? 4, evidence: "fictional" as const };
  if (!spec.choices) return { ...base, mode: "automatic", effects: spec.effects ?? [], choices: [] };
  const choices: Choice[] = spec.choices.map(choice => ({
    id: `${spec.id}-${choice.key}`, text: choice.text, ...(choice.when ? { when: choice.when } : {}),
    outcomes: [{ id: `${spec.id}-${choice.key}-done`, text: choice.result, weight: 1, effects: choice.effects }],
  }));
  return { ...base, ...(spec.scope ? { scope: spec.scope } : {}), choices };
}

const SPECS: Spec[] = [
  { id: "holdings-harvest-carrying", title: "Sheaves to the threshing floor", fields: ["farming"], when: holds("grain", 400),
    stages: ["early-childhood", "childhood"], max: 2, cooldown: 3,
    text: "The harvest is good. Everyone carries, even the children, and the threshing floor is loud until dark.",
    effects: [pull("farming", 5, "carrying sheaves at a good harvest"), stat("health", 1)] },
  { id: "holdings-full-granary", title: "A full granary", fields: ["farming", "trade"], when: holds("grain", 600), stages: HOUSEHOLD_YEARS,
    scope: "household", max: 3, cooldown: 5,
    text: "The storeroom jars are full to the shoulders. There is more grain than the household will eat before the next flood.",
    choices: [
      { key: "expand", text: "Rent the neighbouring strip and sow more", result: "You rent the strip and plan the sowing yourself.",
        effects: [demo({ kind: "harvest-bonus", bps: 1000 }), pull("farming", 10, "planning a larger sowing"), skill("farming", 2)] },
      { key: "lend", text: "Lend seed to neighbours who are short", result: "Neighbours carry away seed and promise grain back at harvest.",
        effects: [demo({ kind: "share-grain", quantity: 100 }), demo({ kind: "reputation", delta: 3 }), stat("bonds", 1)] },
      { key: "prices", text: "Learn what the merchants pay before selling any", result: "You spend market days learning who pays what, and when.",
        effects: [pull("trade", 10, "studying grain prices"), skill("reckoning", 2)] },
    ] },
  { id: "holdings-seed-lending", title: "A neighbour short of seed", fields: ["farming"],
    when: all(holds("grain", 300), { type: "demo", condition: { kind: "year", family: "flood", level: "low" } } as Condition),
    stages: HOUSEHOLD_YEARS, scope: "household", max: 3, cooldown: 4,
    text: "After the low flood, a neighbour comes to the door asking for seed grain to sow.",
    choices: [
      { key: "lend", text: "Lend fifty measures of seed", result: "The neighbour thanks you and sows the whole plot.",
        effects: [demo({ kind: "share-grain", quantity: 50 }), demo({ kind: "reputation", delta: 2 })] },
      { key: "refuse", text: "Keep the seed for your own plot", result: "You keep your seed. The neighbour leaves without a word.", effects: [stat("bonds", -1)] },
    ] },
  { id: "holdings-spare-flax", title: "Spare flax", fields: ["clothing"], when: holds("flax", 10), stages: ["childhood"], max: 1,
    text: "Someone gives you a handful of spare flax, and you twist it into string the way the grown-ups do.",
    effects: [pull("clothing", 5, "twisting spare flax into string")] },
  { id: "holdings-flax-choice", title: "Flax in the store", fields: ["clothing", "trade"], when: holds("flax", 10), stages: WORK_YEARS,
    scope: "work", max: 3, cooldown: 4, text: "There is flax in the storeroom, retted and ready.",
    choices: [
      { key: "spin", text: "Spin it into thread", result: "Your thread starts uneven and ends almost even.", effects: [skill("craft", 2), pull("clothing", 5, "spinning the household's flax")] },
      { key: "price", text: "Ask what flax fetches in the market", result: "You learn the price of flax by season.", effects: [pull("trade", 5, "pricing flax"), skill("reckoning", 1)] },
    ] },
  { id: "holdings-linen-bolt", title: "A bolt of linen", fields: ["clothing", "trade"], when: holds("linen", 2), stages: ["adulthood"],
    scope: "household", max: 2, cooldown: 5, text: "A bolt of good linen lies folded in the household chest.",
    choices: [
      { key: "sew", text: "Cut and sew clothes for the household", result: "Everyone in the house has a new tunic by the festival.",
        effects: [demo({ kind: "item", item: "linen", delta: -1, cause: "cut and sewn into clothes for the household" }), skill("craft", 2), pull("clothing", 5, "sewing for the household"), stat("bonds", 1)] },
      { key: "keep", text: "Keep it to sell when the price is right", result: "You watch the cloth market for a good price.", effects: [pull("trade", 5, "waiting for a good price on linen")] },
    ] },
  { id: "holdings-clay-play", title: "Clay by the door", fields: ["ceramics"], when: any(material("clay", 1), { type: "district", district: "city-quarter" }),
    stages: ["early-childhood", "childhood"], scope: "personal", max: 2, cooldown: 3, text: "A lump of wet clay sits by the door, left from the morning's work.",
    choices: [
      { key: "shape", text: "Shape a little pot", result: "Your pot leans, but it holds water for a day.", effects: [pull("ceramics", 5, "shaping clay by the door"), skill("pottery", 1)] },
      { key: "leave", text: "Leave it and run off to play", result: "You run off. The clay dries hard by evening.", effects: [] },
    ] },
  { id: "holdings-kiln-share", title: "A neighbour's kiln", fields: ["ceramics"], when: all(material("clay", 2), material("fuel", 1)), stages: WORK_YEARS,
    scope: "work", max: 3, cooldown: 3, text: "A neighbour's kiln has room for a few more pots this firing.",
    choices: [
      { key: "fire", text: "Shape pots and fire them in the kiln", result: "Most of your pots come out of the kiln whole.",
        effects: [use("clay", 2, "shaped and fired in a neighbour's kiln"), use("fuel", 1, "shaped and fired in a neighbour's kiln"), skill("pottery", 2), pull("ceramics", 5, "firing pots in a shared kiln")] },
      { key: "keep", text: "Keep the clay for later", result: "You wrap the clay to keep it damp.", effects: [] },
    ] },
  { id: "holdings-papyrus-letters", title: "A sheet of papyrus", fields: ["research"], when: material("papyrus", 1), stages: ["childhood"],
    scope: "personal", max: 2, cooldown: 2, text: "There is a sheet of papyrus and a little ink in the house.",
    choices: [
      { key: "copy", text: "Copy the letters a tutor wrote", result: "You copy every letter twice, and remember most of them.",
        effects: [use("papyrus", 1, "covered with practice letters"), skill("literacy", 2), pull("research", 5, "copying letters")] },
      { key: "draw", text: "Draw boats and birds instead", result: "You fill the margins with boats and birds.", effects: [stat("bonds", 1)] },
    ] },
  { id: "holdings-old-tablets", title: "Old wax tablets", fields: ["trade"], when: any({ type: "origin", origin: "royal-household" }, { type: "origin", origin: "estate-household" }),
    stages: ["childhood", "adolescence"], scope: "personal", max: 1, text: "You find a steward's old wax tablets, full of sums.",
    choices: [
      { key: "sums", text: "Work out the sums", result: "You work the sums until they come out right.", effects: [skill("reckoning", 2), pull("trade", 5, "working a steward's sums")] },
      { key: "ignore", text: "Put them back", result: "You put the tablets back on the shelf.", effects: [] },
    ] },
  { id: "holdings-copy-accounts", title: "The household accounts", fields: ["civic"], when: material("papyrus", 2), stages: WORK_YEARS,
    scope: "work", max: 3, cooldown: 3, text: "The household accounts need a clean copy for the tax collector.",
    choices: [
      { key: "copy", text: "Make the clean copy", result: "The tax collector accepts your copy without a question.",
        effects: [use("papyrus", 1, "used for a clean copy of the household accounts"), skill("literacy", 2), skill("reckoning", 1), pull("civic", 5, "copying accounts for the tax collector")] },
      { key: "leave", text: "Leave it to someone else", result: "Someone else makes the copy.", effects: [] },
    ] },
  { id: "holdings-silver-heirloom", title: "A piece of silver", fields: ["ceramics", "clothing", "sculpture"], when: holds("silver", 1), stages: ["adulthood"],
    scope: "household", max: 1, text: "The household keeps a piece of silver against bad years. A master would teach for less.",
    choices: [
      { key: "potter", text: "Pay a master potter to teach you", when: { type: "affinity", field: "ceramics", op: "gte", value: 10 }, result: "The master potter takes your silver and your hands.",
        effects: [demo({ kind: "item", item: "silver", delta: -1, cause: "paid to a master potter for teaching" }), skill("pottery", 4), pull("ceramics", 15, "a master potter's teaching")] },
      { key: "weaver", text: "Pay a master weaver to teach you", when: { type: "affinity", field: "clothing", op: "gte", value: 10 }, result: "The master weaver sets you at a loom.",
        effects: [demo({ kind: "item", item: "silver", delta: -1, cause: "paid to a master weaver for teaching" }), skill("craft", 4), pull("clothing", 15, "a master weaver's teaching")] },
      { key: "carver", text: "Pay a master carver to teach you", when: { type: "affinity", field: "sculpture", op: "gte", value: 10 }, result: "The master carver hands you a chisel.",
        effects: [demo({ kind: "item", item: "silver", delta: -1, cause: "paid to a master carver for teaching" }), skill("sculpture", 4), pull("sculpture", 15, "a master carver's teaching")] },
      { key: "keep", text: "Keep the silver for bad years", result: "The silver stays in its hiding place.", effects: [] },
    ] },
  { id: "holdings-savings-plan", title: "Savings in the jar", fields: ["trade"], when: { type: "cash", op: "gte", value: 80 }, stages: ["adulthood"],
    scope: "household", max: 2, cooldown: 6, text: "The money jar is heavier than it has been for years.",
    choices: [
      { key: "plan", text: "Plan a small trading venture", result: "You work out what to buy, where, and what it would sell for.", effects: [pull("trade", 10, "planning a trading venture"), skill("reckoning", 2)] },
      { key: "keep", text: "Leave the savings untouched", result: "The jar goes back under the floor.", effects: [] },
    ] },
  { id: "holdings-ox-ploughing", title: "The ox and the neighbours' plots", fields: ["farming"], when: holds("ox", 1), stages: WORK_YEARS,
    scope: "work", max: 3, cooldown: 3, text: "Neighbours without an ox ask whether yours could plough their plots too.",
    choices: [
      { key: "plough", text: "Plough the neighbours' plots", result: "You plough until the ox will go no further.", effects: [skill("farming", 2), demo({ kind: "reputation", delta: 1 })] },
      { key: "rest", text: "Rest the ox this year", result: "The ox rests, and so do you.", effects: [] },
    ] },
  { id: "holdings-donkey-hauling", title: "The donkey and the market road", fields: ["trade"], when: holds("donkey", 1), stages: WORK_YEARS,
    scope: "work", max: 3, cooldown: 3, text: "Neighbours ask whether your donkey could carry their goods to market.",
    choices: [
      { key: "haul", text: "Haul the neighbours' goods to market", result: "You learn every stall and price on the way.", effects: [pull("trade", 5, "hauling goods to market"), skill("reckoning", 1)] },
      { key: "no", text: "Keep the donkey at home", result: "The donkey stays in its stall.", effects: [] },
    ] },
  { id: "holdings-stone-offcut", title: "An offcut of stone", fields: ["sculpture"],
    when: any({ type: "district", district: "city-quarter" }, { type: "district", district: "court-quarter" }), stages: WORK_YEARS,
    scope: "work", max: 2, cooldown: 4, text: "A carver's yard throws out an offcut of good limestone.",
    choices: [
      { key: "carve", text: "Carve something from it", result: "You carve a small head. It looks like no one in particular.", effects: [skill("sculpture", 2), pull("sculpture", 5, "carving a limestone offcut")] },
      { key: "leave", text: "Leave it", result: "Someone else takes the stone.", effects: [] },
    ] },
  { id: "holdings-army-kit", title: "The old army kit", fields: ["soldiering"], when: { type: "origin", origin: "soldier-household" }, stages: ["childhood"], max: 1,
    text: "You find a parent's old army kit in a chest: a dented helmet, a belt and a short sword in its scabbard.",
    effects: [pull("soldiering", 5, "the family's old army kit")] },
  { id: "holdings-drill-yard", title: "The drill yard", fields: ["soldiering"], when: { type: "district", district: "garrison" }, stages: ["adolescence", "youth"],
    scope: "personal", max: 2, cooldown: 2, text: "Boys from the garrison families join the soldiers' drill at the end of the yard.",
    choices: [
      { key: "join", text: "Join the drill", result: "You keep the step badly at first, then well.", effects: [skill("warfare", 2), pull("soldiering", 5, "joining the garrison drill")] },
      { key: "watch", text: "Watch from the wall", result: "You watch until the drill ends.", effects: [] },
    ] },
  { id: "holdings-market-stall", title: "The family stall", fields: ["trade"], when: any(holds("linen", 1), holds("grain", 200)), stages: HOUSEHOLD_YEARS,
    scope: "household", max: 3, cooldown: 4, text: "The household has goods to spare, and someone has to mind the family's market stall.",
    choices: [
      { key: "mind", text: "Mind the stall yourself", result: "You learn who haggles and who pays.", effects: [pull("trade", 5, "minding the family stall"), skill("reckoning", 2), stat("bonds", 1)] },
      { key: "others", text: "Leave it to others", result: "A cousin minds the stall.", effects: [] },
    ] },
  ...(["ceramics", "clothing", "sculpture"] as const).map((field): Spec => {
    const tool = { ceramics: "a potter's turning tool", clothing: "a weaver's shuttle", sculpture: "a carver's chisel" }[field];
    return { id: `holdings-gift-of-tools-${field}`, title: "A gift of tools", fields: [field], when: { type: "introduced", field }, stages: WORK_YEARS, max: 1,
      text: `The master you met sends you ${tool}, worn smooth by years of use.`, effects: [pull(field, 5, `a gift of ${tool}`)] };
  }),
];

export function holdingsEvents(): LifeEvent[] {
  return SPECS.map(build);
}
