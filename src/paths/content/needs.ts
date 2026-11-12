/** World needs: scarce fields ask for workers, war recruits, floods make grain dear, good years commission. */
import type { Choice, Condition, Effect, LifeEvent } from "../../types.ts";
import { MILITARY_QUALIFICATIONS } from "../../capabilities/military.ts";
import type { DecisionScope } from "../../life-stages/types.ts";
import { FIELD_IDS } from "../types.ts";
import type { FieldId } from "../types.ts";

const SCARCE_TEXT: Record<FieldId, { title: string; text: string }> = {
  farming: { title: "Hands wanted in the fields", text: "Plots lie half-sown for want of farmers. Landholders are asking around for anyone who can work them, and paying more than usual." },
  clothing: { title: "Weavers wanted", text: "The weaving shops cannot keep up with orders. Cloth merchants are offering better rates to anyone who can spin or weave." },
  ceramics: { title: "Potters wanted", text: "There are too few potters for the jars the district needs. Workshops pay better than usual for a pair of steady hands." },
  sculpture: { title: "Carvers wanted", text: "A new building needs carved stone and there are too few carvers. The yards pay well for anyone who can hold a chisel." },
  research: { title: "Scholars wanted", text: "Few here can read and reason well. Families pay a good fee for anyone who can teach their children or check a calculation." },
  civic: { title: "Scribes wanted", text: "The record office is short of scribes. Officials pay well for anyone who can copy a decree and keep an account." },
  trade: { title: "Traders wanted", text: "Few traders work the district and goods sit unsold. Suppliers pay a premium for anyone who will carry and sell their goods." },
  soldiering: { title: "Soldiers wanted", text: "The garrison is short of men. Its officers offer better pay than usual to anyone fit to serve." },
};

const ENTRY_SKILL: Record<FieldId, string> = {
  farming: "farming", clothing: "craft", ceramics: "pottery", sculpture: "sculpture",
  research: "philosophy", civic: "literacy", trade: "reckoning", soldiering: "warfare",
};

const ARMY_AT_WAR: Condition = { type: "demo", condition: { kind: "year", family: "army", level: "war" } } as Condition;

/**
 * Draw weights against ordinary stories (weight 1). A decision slot draws from ~150 eligible
 * stories, so scarcity offers and good-year commissions need weight to be felt.
 */
export const WEIGHT = { scarce: 4, season: 3 } as const;

const pull = (field: FieldId, delta: number, source: string): Effect => ({ type: "affinity", field, delta, source });
const skill = (id: string, delta: number): Effect => ({ type: "skill", skill: id, delta });

interface Spec {
  id: string; title: string; text: string; when: Condition; stages: string[]; scope: DecisionScope; fields: FieldId[];
  choices: Array<{ key: string; text: string; result: string; effects: Effect[]; when?: Condition }>;
  max?: number; cooldown?: number; weight?: number;
  /** A direct consequence: offered as soon as its cause holds, instead of waiting for a random slot; with `max` above one it recurs after `cooldown` years. */
  anchor?: boolean;
}

/** The first year of this world's calendar; dated decisions become eligible from it. */
export const ANCHOR_YEAR = -350;

export function buildDecision(spec: Spec): LifeEvent {
  const choices: Choice[] = spec.choices.map(choice => ({
    id: `${spec.id}-${choice.key}`, text: choice.text, ...(choice.when ? { when: choice.when } : {}),
    outcomes: [{ id: `${spec.id}-${choice.key}-done`, text: choice.result, weight: 1, effects: choice.effects }],
  }));
  // An anchor with `max` above one recurs, spaced by `cooldown` years.
  const timing = spec.anchor
    ? { trigger: { type: "year" as const, at: ANCHOR_YEAR }, maxOccurrences: spec.max ?? 1, ...(spec.max && spec.max > 1 ? { cooldownYears: spec.cooldown ?? 4 } : {}) }
    : { trigger: { type: "random" as const, weight: spec.weight ?? 1 }, maxOccurrences: spec.max ?? 2, cooldownYears: spec.cooldown ?? 4 };
  return { id: spec.id, title: spec.title, text: spec.text, ...timing, when: spec.when,
    stages: spec.stages, scope: spec.scope, fields: spec.fields, evidence: "fictional", choices };
}

const scarce = (field: FieldId): Spec => ({
  id: `need-scarce-${field}`, ...SCARCE_TEXT[field], when: { type: "field-need", field, label: "scarce" },
  stages: ["youth", "adulthood", "later-life"], scope: "work", fields: [field], max: 3, cooldown: 5, weight: WEIGHT.scarce,
  choices: [
    { key: "ask", text: "Ask for work there", result: "You are told where to go and whom to ask. The pay is better than you expected.",
      effects: [pull(field, 10, "a district short of hands"), { type: "introduce-field", field }] },
    { key: "pass", text: "It is not work for you", result: "You leave it to others.", effects: [] },
  ],
});

const masterOffer = (field: FieldId): Spec => ({
  id: `need-master-offer-${field}`, title: "An offer from a master", when: { type: "introduced", field },
  text: "The master you met sends word: there is room beside them this season, if you want to learn.",
  stages: ["adolescence", "youth"], scope: "work", fields: [field], anchor: true,
  choices: [
    { key: "accept", text: "Work beside the master for a season", result: "You work beside the master from first light, and learn more than you expected.",
      effects: [skill(ENTRY_SKILL[field], 3), pull(field, 10, "a season beside a master")] },
    { key: "decline", text: "Decline politely", result: "You send your thanks and stay where you are.", effects: [] },
  ],
});

const commission = (field: "ceramics" | "clothing" | "sculpture"): Spec => {
  const work = { ceramics: "a set of storage jars", clothing: "festival clothes for a wedding", sculpture: "a carved door lintel" }[field];
  return {
    id: `need-commission-${field}`, title: "A commission in a good year", fields: [field], stages: ["adulthood"], scope: "work", max: 3, cooldown: 4, weight: WEIGHT.season,
    when: { type: "all", conditions: [
      { type: "any", conditions: [
        { type: "demo", condition: { kind: "year", family: "flood", level: "normal" } },
        { type: "demo", condition: { kind: "year", family: "flood", level: "high" } },
      ] } as Condition,
      { type: "affinity", field, op: "gte", value: 20 },
    ] },
    text: `The harvest was good and people are spending. A neighbour asks whether you could make ${work}.`,
    choices: [
      { key: "accept", text: "Take on the work", result: "You finish it late, but it is admired.", effects: [skill(ENTRY_SKILL[field], 3), pull(field, 5, "a good-year commission"), { type: "demo", effect: { kind: "reputation", delta: 1 } } as Effect] },
      { key: "decline", text: "You have no time this year", result: "The neighbour asks someone else.", effects: [] },
    ],
  };
};

/** Signing the roll needs the atlas qualification for a soldier; anyone without it can drill instead. */
const SIGN_QUALIFIED: Condition = { type: "capability", node: MILITARY_QUALIFICATIONS.soldier };

const SPECS: Spec[] = [
  ...FIELD_IDS.map(scarce),
  ...FIELD_IDS.map(masterOffer),
  ...(["ceramics", "clothing", "sculpture"] as const).map(commission),
  { id: "need-war-recruiting", title: "Recruiters in the market", fields: ["soldiering"], stages: ["adulthood"], scope: "community", anchor: true,
    // At the height of a war (the first recruiting year belongs to the household levy), and only once
    // the life is old enough to sign the roll, so the one offer is never wasted on a child.
    when: { type: "all", conditions: [ARMY_AT_WAR, { type: "age", op: "gte", value: 18 }, { type: "not", condition: { type: "job", job: "soldier" } }] },
    text: "Recruiters stand in the market offering better pay than in quiet years. The army is short of men, and everyone knows why: some who march out will not come back.",
    choices: [
      { key: "enlist", text: "Enlist for the pay, and the danger", when: SIGN_QUALIFIED,
        result: "You put your mark on the roll and are told when to report.", effects: [{ type: "job", job: "soldier" }, { type: "flag", flag: "army-service", value: true }, pull("soldiering", 10, "enlisting in a war year")] },
      { key: "drill", text: "Drill with the recruits before deciding", when: { type: "not", condition: SIGN_QUALIFIED },
        result: "You drill with the recruits until your arms ache. Once you have proved your drill and equipment, you could sign.", effects: [skill("warfare", 5), pull("soldiering", 10, "drilling with the recruits")] },
      { key: "stay", text: "Stay with the work you have", result: "You walk past the recruiters.", effects: [] },
    ] },
  { id: "need-flood-trade", title: "Grain is dear", fields: ["trade"], stages: ["adulthood"], scope: "household", max: 3, cooldown: 3, weight: WEIGHT.season,
    when: { type: "all", conditions: [{ type: "demo", condition: { kind: "year", family: "flood", level: "low" } } as Condition,
      { type: "demo", condition: { kind: "item", item: "grain", op: "gte", value: 200 } } as Condition] },
    text: "After the low flood, grain fetches a high price. Merchants are asking households with stores what they would sell.",
    choices: [
      { key: "price", text: "Work out a fair price for what you can spare", result: "You learn how far a fair price can go in a hungry year.",
        effects: [pull("trade", 10, "pricing grain in a hungry year"), skill("reckoning", 2), { type: "demo", effect: { kind: "reputation", delta: 1 } } as Effect] },
      { key: "keep", text: "Keep every measure for the household", result: "The jars stay sealed.", effects: [] },
    ] },
];

export function needsEvents(): LifeEvent[] {
  return SPECS.map(buildDecision);
}
