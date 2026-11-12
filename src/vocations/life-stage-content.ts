/**
 * Life stages for free-play Alexandria: every event gets a time frame, and decisions that belong
 * to the household or community are resolved by them while the player is too young.
 */
import type { Condition, Effect, LifeEvent, WorldPack } from "../types.ts";
import type { DecisionScope, DependentResolution, LifeStagesDefinition } from "../life-stages/types.ts";

export const ALEXANDRIA_LIFE_STAGES: LifeStagesDefinition = {
  stages: [
    { id: "infancy", title: "Infancy", minAge: 0 },
    { id: "early-childhood", title: "Early childhood", minAge: 3 },
    { id: "childhood", title: "Childhood", minAge: 6 },
    // Graeco-Roman Egypt: apprenticeships often began before the teens; at 14 a boy entered the
    // poll-tax register and, for Greek families, the ephebate; most women married by their later teens.
    { id: "adolescence", title: "Adolescence", minAge: 12 },
    { id: "youth", title: "Youth", minAge: 14 },
    { id: "adulthood", title: "Adulthood", minAge: 16 },
    { id: "later-life", title: "Later life", minAge: 60 },
  ],
  scopes: { personal: "early-childhood", work: "adolescence", community: "youth", household: "adulthood" },
};

const demo = (condition: Record<string, unknown>): Condition => ({ type: "demo", condition } as Condition);
const demoEffect = (effect: Record<string, unknown>): Effect => ({ type: "demo", effect } as Effect);
const stat = (id: string, delta: number): Effect => ({ type: "stat", stat: id, delta });
const has = (item: string, value: number): Condition => demo({ kind: "item", item, op: "gte", value });

const FLOOD: DependentResolution = {
  text: "The Nile flood falls short. The grown-ups of your household decide how the family will get through the year.",
  responses: [
    { id: "household-shares-grain", when: has("grain", 300),
      text: "Your household has grain enough. Your parents share 100 measures with neighbours who have none, and people in the lane greet your family warmly.",
      effects: [demoEffect({ kind: "share-grain", quantity: 100 }), demoEffect({ kind: "reputation", delta: 3 }), stat("bonds", 1)] },
    { id: "household-sells-silver", when: has("silver", 1),
      text: "Your parents sell a piece of the household's silver to buy grain. You remember the empty shelf where it used to stand.",
      effects: [demoEffect({ kind: "item", item: "silver", delta: -1, cause: "sold by the household to buy grain in the flood year" }), { type: "cash", delta: 50 }] },
    { id: "household-cuts-portions",
      text: "Your mother cuts every portion and keeps the seed grain sealed in its jars. You go to sleep hungry for much of the year.",
      effects: [stat("health", -3), demoEffect({ kind: "harvest-bonus", bps: 1500 })] },
  ],
};

const LEVY: DependentResolution = {
  text: "The levy comes to the district. Officers walk the lanes with a list of names, and the grown-ups answer for your household.",
  responses: [
    { id: "household-sends-provisions", when: has("grain", 200),
      text: "Your household sends 150 measures of grain to the muster in place of a son. The jars stand emptier, and the officer marks your family as having given.",
      effects: [demoEffect({ kind: "grain", delta: -150, cause: "provisions the household sent to the army muster" }), demoEffect({ kind: "reputation", delta: 4 }), { type: "flag", flag: "experienced-war", value: true }] },
    { id: "household-pays-substitute", when: { type: "cash", op: "gte", value: 60 },
      text: "Your parents pay the 60-drachma substitute fee so no one from your house is taken. Money for the year grows tight.",
      effects: [{ type: "cash", delta: -60 }, { type: "flag", flag: "experienced-war", value: true }] },
    { id: "relative-taken-for-drill",
      text: "An uncle is taken for drill. For months there are fewer hands on the plot; you carry water and mind the animals while the grown-ups work longer days.",
      effects: [stat("health", -1), { type: "flag", flag: "experienced-war", value: true }] },
  ],
};

const CARE: DependentResolution = {
  text: "You fall ill. You are too young to arrange your own care, so the household decides what to do.",
  responses: [
    { id: "household-pays-healer", when: { type: "cash", op: "gte", value: 10 },
      text: "Your parents pay a healer 10 drachmas to see you, and follow the healer's instructions.",
      effects: [{ type: "cash", delta: -10 }, { type: "care", amount: 0.9 }, stat("health", 5)] },
    { id: "household-nurses-at-home",
      text: "Your family keeps you in bed, brings you broth and takes turns sitting with you.",
      effects: [{ type: "care", amount: 0.55 }, stat("health", 3)] },
  ],
};

const offerAnsweredByHousehold = (offer: string, what: string): DependentResolution => ({
  text: `A townsperson sends an offer to your household: ${what}. The grown-ups answer it.`,
  responses: [{ id: `household-declines-${offer}`, text: "Your household turns the offer down. Terms like these are for grown-ups to keep.",
    effects: [demoEffect({ kind: "offer", action: "decline" })] }],
});

/** Who decides each event that is not the player's own matter, and how others resolve it. */
const SCOPED: Record<string, { scope: DecisionScope; dependent?: DependentResolution; dropAgeGate?: boolean }> = {
  "flood-failure": { scope: "household", dependent: FLOOD },
  // The household answers the levy: who goes, what is sent, whether a substitute fee is paid.
  "levy-call": { scope: "household", dependent: LEVY, dropAgeGate: true },
  "agent-offer-grain-contract": { scope: "household", dependent: offerAnsweredByHousehold("grain-contract", "to buy grain from the store") },
  "agent-offer-seed-credit": { scope: "household", dependent: offerAnsweredByHousehold("seed-credit", "seed grain on credit") },
  "agent-offer-goods-deal": { scope: "household", dependent: offerAnsweredByHousehold("goods-deal", "goods for sale") },
  "agent-offer-convoy-job": { scope: "work", dependent: offerAnsweredByHousehold("convoy-job", "pay to guard a grain convoy") },
  "demo-convoy-muster": { scope: "work" },
  "demo-convoy-road": { scope: "work" },
  "classical-succession-guard": { scope: "work" },
  "v-workshop-safety": { scope: "work" },
  "v-evidence-dispute": { scope: "work" },
  "v-public-ledger": { scope: "work" },
};

/** The inclusive age window an event's own conditions allow; `any` branches are not narrowed. */
export function ageWindow(event: LifeEvent, maxAge: number): [number, number] {
  let low = event.trigger.type === "age" ? event.trigger.at : 0;
  let high = maxAge;
  const visit = (condition: Condition | undefined): void => {
    if (!condition) return;
    if (condition.type === "all") { condition.conditions.forEach(visit); return; }
    if (condition.type !== "age") return;
    const { op, value } = condition;
    if (op === "gte") low = Math.max(low, value);
    else if (op === "gt") low = Math.max(low, value + 1);
    else if (op === "lte") high = Math.min(high, value);
    else if (op === "lt") high = Math.min(high, value - 1);
    else if (op === "eq") { low = Math.max(low, value); high = Math.min(high, value); }
  };
  visit(event.when);
  return [low, high];
}

/** Stage IDs overlapping an inclusive age window. */
export function stagesFor(ages: [number, number], definition = ALEXANDRIA_LIFE_STAGES): string[] {
  const { stages } = definition;
  return stages.filter((stage, i) => {
    const end = i + 1 < stages.length ? stages[i + 1].minAge - 1 : Number.MAX_SAFE_INTEGER;
    return stage.minAge <= ages[1] && end >= ages[0];
  }).map(stage => stage.id);
}

function withoutAgeGate(condition: Condition | undefined): Condition | undefined {
  if (condition?.type !== "all") return condition;
  return { ...condition, conditions: condition.conditions.filter(item => item.type !== "age") };
}

function interruptIds(world: WorldPack): Set<string> {
  const lender = world.economy?.moneylender?.events;
  return new Set([world.health?.careDecision, ...(lender ? Object.values(lender) : [])].filter((id): id is string => Boolean(id)));
}

/** Returns a new pack with life stages, event time frames, scopes and dependent resolutions. */
export function applyLifeStageContent(base: WorldPack): WorldPack {
  const world = structuredClone(base);
  world.lifeStages = structuredClone(ALEXANDRIA_LIFE_STAGES);
  const interrupts = interruptIds(world);
  world.events = world.events.map(event => {
    const rule = SCOPED[event.id];
    const next: LifeEvent = { ...event, ...(rule?.dropAgeGate ? { when: withoutAgeGate(event.when) } : {}) };
    if (rule) {
      next.scope = rule.scope;
      if (rule.dependent) next.dependent = structuredClone(rule.dependent);
    }
    if (event.id === world.health?.careDecision) {
      next.scope = "household";
      next.dependent = structuredClone(CARE);
    }
    if (event.trigger.type !== "year" && !interrupts.has(event.id)) {
      // Retired content is switched off with an impossible age (`age < 0`); keep it off, in its trigger's stage.
      const [low, high] = ageWindow(event, world.maxAge);
      next.stages = stagesFor(high < low ? [low, low] : [low, high]);
    }
    return next;
  });
  return world;
}
