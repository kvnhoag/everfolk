/**
 * Events that answer progress on the skill atlas: word gets around at depth 5, an invitation at depth 8,
 * and recognition at depth 10. Also the body and military lane for youth, and village farming life.
 * No event creates money or goods.
 */
import type { Condition, Effect, LifeEvent } from "../../types.ts";
import type { FieldId } from "../types.ts";
import { ANCHOR_YEAR, buildDecision } from "./needs.ts";

interface Specialization { field: FieldId; skill: string; people: string; apprentice: string; invitation: string; recognition: string }

const SPECIALIZATIONS: Record<string, Specialization> = {
  FC: { field: "farming", skill: "farming", people: "growers",
    apprentice: "Neighbours have noticed how your fields come up. A younger grower asks to work beside you and learn your sowing.",
    invitation: "The village elders ask you to sit with them when the channel shares and sowing days are set.",
    recognition: "People come from other villages to see how you sow. Your name is used when growers argue about the right way." },
  FR: { field: "farming", skill: "farming", people: "growers",
    apprentice: "In a lean year your household still ate. A neighbour asks you to show their son how you keep your stores.",
    invitation: "The landholder asks you to advise on how the estate's stores should be kept against bad floods.",
    recognition: "Your stores carried your household through floods that emptied others. The village counts you among its wisest growers." },
  AT: { field: "clothing", skill: "craft", people: "weavers",
    apprentice: "Your cloth is noticed at the market. A girl from the next street asks to learn at your loom.",
    invitation: "The cloth merchants' association invites you to inspect cloth for them before it is sold on.",
    recognition: "Buyers ask for cloth from your loom by name. You are counted among the finest weavers of the district." },
  AC: { field: "ceramics", skill: "pottery", people: "potters",
    apprentice: "Your jars are sound and people say so. A boy asks to sweep your workshop if you will teach him the wheel.",
    invitation: "A workshop master invites you to share his kiln and teach his apprentices.",
    recognition: "Your vessels are copied by other potters. You are counted among the master potters of the district." },
  AS: { field: "sculpture", skill: "sculpture", people: "sculptors",
    apprentice: "A carved piece of yours stands where people pass. A young carver asks to hold your tools and learn.",
    invitation: "A temple builder invites you to carve for the new courtyard alongside the yard's masters.",
    recognition: "Your figures are pointed out to visitors. You are counted among the renowned sculptors of the city." },
  PS: { field: "research", skill: "philosophy", people: "scholars",
    apprentice: "Your careful observations are talked about. A student asks to copy your notes and follow your method.",
    invitation: "Scholars near the court invite you to read your observations to them and answer their questions.",
    recognition: "Your work is copied and argued over by other scholars. You are counted among the learned people of the city, whose judgement others ask for." },
  PP: { field: "civic", skill: "oratory", people: "officials",
    apprentice: "Your fair settling of disputes is remembered. A young clerk asks to learn how you prepare a hearing.",
    invitation: "The district's officials invite you to speak for the district at the next gathering.",
    recognition: "People bring their disputes to you before they go to any office. You are counted among the respected officials of the city." },
  T: { field: "trade", skill: "reckoning", people: "traders",
    apprentice: "Your accounts always balance and merchants say so. A young porter asks to learn your reckoning.",
    invitation: "A trading house invites you to its table when cargoes are bought and prices set.",
    recognition: "Your word settles a price. You are counted among the renowned traders of the harbour." },
  M: { field: "soldiering", skill: "warfare", people: "soldiers",
    apprentice: "Your drill is steady and the officers notice. A new recruit is placed beside you to learn from you.",
    invitation: "The officers invite you to plan the season's exercises with them.",
    recognition: "Soldiers tell stories about your command. You are counted among the renowned soldiers of the garrison." },
};

const ADULT_STAGES = ["adulthood", "later-life"];
const learned = (node: string): Condition => ({ type: "capability", node });
const pull = (field: FieldId, delta: number, source: string): Effect => ({ type: "affinity", field, delta, source });
const standing = (delta: number): Effect => ({ type: "demo", effect: { kind: "reputation", delta } } as Effect);

function apprentice(prefix: string, spec: Specialization): LifeEvent {
  return buildDecision({ id: `milestone-${prefix.toLowerCase()}5`, title: "Word gets around", text: spec.apprentice,
    when: learned(`${prefix}5`), stages: ADULT_STAGES, scope: "work", fields: [spec.field], anchor: true,
    choices: [
      { key: "teach", text: "Take them on and teach", result: "Teaching makes you explain what you only knew by hand. Your standing grows.",
        effects: [{ type: "skill", skill: spec.skill, delta: 1 }, standing(1), pull(spec.field, 5, `teaching other ${spec.people}`)] },
      { key: "own-work", text: "Keep to your own work", result: "You keep your hours for your own work, and it shows.",
        effects: [{ type: "skill", skill: spec.skill, delta: 2 }] },
    ] });
}

function invitation(prefix: string, spec: Specialization): LifeEvent {
  return buildDecision({ id: `milestone-${prefix.toLowerCase()}8`, title: "An invitation", text: spec.invitation,
    when: learned(`${prefix}8`), stages: ADULT_STAGES, scope: "work", fields: [spec.field], anchor: true,
    choices: [
      { key: "accept", text: "Accept the invitation", result: `You take your place among the ${spec.people} who are asked for their judgement.`,
        effects: [standing(2), pull(spec.field, 10, `the respect of other ${spec.people}`), { type: "stat", stat: "bonds", delta: 2 }] },
      { key: "decline", text: "Decline and keep working", result: "You send your thanks. There is work waiting.", effects: [] },
    ] });
}

/** Recognition happens to the life; there is nothing to choose. */
function recognition(prefix: string, spec: Specialization): LifeEvent {
  const id = `milestone-${prefix.toLowerCase()}10`;
  // Anchored: it happens as soon as the node is learned, not in a random story slot.
  return { id, title: "Recognised", text: spec.recognition, trigger: { type: "year", at: ANCHOR_YEAR }, mode: "automatic",
    when: { type: "all", conditions: [learned(`${prefix}10`), { type: "flag", flag: `recognised-${prefix.toLowerCase()}`, value: false }] },
    stages: ADULT_STAGES, fields: [spec.field], maxOccurrences: 1, evidence: "fictional", choices: [],
    effects: [standing(3), { type: "join-district", field: spec.field, tier: "renowned" }, { type: "flag", flag: `recognised-${prefix.toLowerCase()}`, value: true }] };
}

/** Youth: the gymnasium and the drill ground, the start of the body and military lane. */
function bodyEvents(): LifeEvent[] {
  return [
    buildDecision({ id: "youth-gymnasium", title: "Games at the gymnasium", fields: ["soldiering"], stages: ["youth"], scope: "personal", max: 2, cooldown: 2, weight: 2,
      when: { type: "stat", stat: "health", op: "gte", value: 40 },
      text: "Young people race and wrestle in the gymnasium yard in the cool of the evening. A trainer is watching for anyone with promise.",
      choices: [
        { key: "train", text: "Run and wrestle with them", result: "You are sore for days, and stronger for it.",
          effects: [{ type: "skill", skill: "strength", delta: 3 }, { type: "skill", skill: "endurance", delta: 3 }, pull("soldiering", 5, "the gymnasium yard")] },
        { key: "watch", text: "Watch from the wall", result: "You watch and go home before dark.", effects: [] },
      ] }),
    buildDecision({ id: "youth-drill-ground", title: "The drill ground", fields: ["soldiering"], stages: ["youth"], scope: "personal", max: 1, weight: 2,
      when: { type: "any", conditions: [{ type: "district", district: "garrison" }, { type: "demo", condition: { kind: "year", family: "army", level: "war" } } as Condition] },
      text: "Recruits drill outside the walls. An old soldier says that anyone who wants to serve at eighteen should learn drill and equipment first.",
      choices: [
        { key: "drill", text: "Join the drill when you can", result: "You learn to hold a line and carry the weight of equipment.",
          effects: [{ type: "skill", skill: "warfare", delta: 3 }, { type: "skill", skill: "endurance", delta: 2 }, pull("soldiering", 10, "drilling with recruits")] },
        { key: "leave", text: "It is not for you", result: "You walk on.", effects: [] },
      ] }),
  ];
}

/** Village farming life: why inputs are cheaper and work at home is healthier there. */
function villageEvents(): LifeEvent[] {
  return [
    buildDecision({ id: "village-seed-exchange", title: "Seed from the neighbours", fields: ["farming"], stages: ["youth", "adulthood"], scope: "work", max: 1, weight: 3,
      when: { type: "district", district: "delta-village" },
      text: "Before sowing, the village families swap seed and share the work of clearing the channels. Nobody pays the merchant's price for what a neighbour has spare.",
      choices: [
        { key: "join", text: "Join the exchange and the channel work", result: "You learn whose seed comes up best, and the channels are clear before the water.",
          effects: [{ type: "skill", skill: "farming", delta: 2 }, pull("farming", 5, "the village seed exchange"), { type: "stat", stat: "bonds", delta: 2 }] },
        { key: "keep", text: "Keep to your own household", result: "You keep your own seed and your own counsel.", effects: [] },
      ] }),
  ];
}

/** Flags the recognition events set, with their labels, for the world's flag list. */
export function milestoneFlags(): Record<string, { label: string; initial: false }> {
  return Object.fromEntries(Object.entries(SPECIALIZATIONS).map(([prefix, spec]) =>
    [`recognised-${prefix.toLowerCase()}`, { label: `Recognised among the ${spec.people}`, initial: false }]));
}

export function milestoneEvents(): LifeEvent[] {
  return [
    ...Object.entries(SPECIALIZATIONS).flatMap(([prefix, spec]) => [apprentice(prefix, spec), invitation(prefix, spec), recognition(prefix, spec)]),
    ...bodyEvents(),
    ...villageEvents(),
  ];
}
