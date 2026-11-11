/**
 * Track C — authored content for the demo world: the soldier paid from the army purse, the convoy as two
 * chained decision events (muster → road) and the `service` legacy route with `convoy-distinction`.
 *
 * The convoy events are year-anchored at the world's first year so they are always eligible while their
 * condition holds. Scheduled events may only occur once (validator rule), so `openShipment` in
 * `service.ts` re-arms both events each time a new shipment is created.
 */
import type { Choice, Condition, Effect, JobDefinition, LegacyAchievementDefinition, LegacyRouteDefinition, LifeEvent, Outcome } from "../../types.ts";
import type { DemoContent } from "./types.ts";
import type { DemoCondition, DemoEffect } from "../types.ts";
import { CONVOY_DISTINCTION } from "../types.ts";
import { DEMO_CONFIG } from "../config.ts";

export const CONVOY_MUSTER_EVENT_ID = "demo-convoy-muster";
/** The key decision of a convoy (design §6: convoy road → draw category `road`). */
export const CONVOY_ROAD_EVENT_ID = "demo-convoy-road";
export const SERVICE_ROUTE_ID = "service";

/** First year of `alexandria-ranked-1`; the validator requires anchors inside the calendar. */
const ANCHOR_YEAR = -350;
/** Thresholds the content and the preview share. */
export const CONVOY_THRESHOLDS = { trainedWarfare: 30, guardWarfare: 20, veteranWarfare: 45, goodHealth: 60, carefulReckoning: 30, companionReputation: 40 } as const;
/** People a player can befriend in the ranked world; any friend or business partner may ride along. */
const COMPANION_PEOPLE = ["person-harbor", "person-market", "person-workshop", "person-linen", "person-copies", "person-bakery", "person-well", "person-festival",
  "person-library", "person-music", "person-boat", "person-drill", "person-garden", "person-accounts", "person-pottery", "person-neighbors"];

const demo = (condition: DemoCondition): Condition => ({ type: "demo", condition });
const convoy = (action: Extract<DemoEffect, { kind: "convoy" }>["action"], lossBps?: number): Effect =>
  ({ type: "demo", effect: { kind: "convoy", action, ...(lossBps === undefined ? {} : { lossBps }) } });
const road = (level: "uneasy" | "dangerous"): Condition => demo({ kind: "year", family: "road", level });
const warfare = (value: number): Condition => ({ type: "skill", skill: "warfare", op: "gte", value });
const goodHealth: Condition = { type: "stat", stat: "health", op: "gte", value: CONVOY_THRESHOLDS.goodHealth };
const reckoning: Condition = { type: "skill", skill: "reckoning", op: "gte", value: CONVOY_THRESHOLDS.carefulReckoning };

/** Weight-modifier reasons; the preview reports each one's effect on expected loss. */
export const RISK_REASONS = {
  trained: "Warfare training", veteran: "Seasoned in warfare", health: "Good health", reckoning: "Careful reckoning of supplies",
  dangerous: "Dangerous road", uneasy: "Uneasy road",
} as const;

// ── The soldier ─────────────────────────────────────────────────────────────

/** Same id and requirements as the ranked soldier; the fixed wealth gain is gone (wages come from the purse). */
const SOLDIER: JobDefinition = {
  id: "soldier",
  title: "Royal army soldier",
  description: "Drill, guard stores and escort the army's grain. Your wage and rations come from the quartermaster's purse and stores, so a short purse means short pay.",
  minAge: 18,
  requirements: { warfare: 10 },
  yearlyEffects: [
    { type: "skill", skill: "warfare", delta: 2 },
    { type: "stat", stat: "health", delta: -1 },
    { type: "stat", stat: "bonds", delta: -1 },
  ],
};

// ── The muster ──────────────────────────────────────────────────────────────

const canProvision: Condition = { type: "cash", op: "gte", value: DEMO_CONFIG.service.provisionsCost };
const hasCompanion: Condition = {
  type: "any",
  conditions: [
    demo({ kind: "reputation", op: "gte", value: CONVOY_THRESHOLDS.companionReputation }),
    ...COMPANION_PEOPLE.flatMap(partner => (["friend", "business-partner"] as const).map(role => ({ type: "social-role", partner, role, active: true }) as Condition)),
  ],
};
const provisions: Effect[] = [{ type: "cash", delta: -DEMO_CONFIG.service.provisionsCost }, convoy("provision")];

function setOut(id: string, text: string, outcome: string, effects: Effect[], when?: Condition): Choice {
  return { id, text, ...(when ? { when } : {}), outcomes: [{ id: `${id}-result`, text: outcome, weight: 1, effects: [...effects, convoy("depart")] }] };
}

const MUSTER: LifeEvent = {
  id: CONVOY_MUSTER_EVENT_ID,
  title: "The convoy musters",
  text: "Carts of grain stand loaded at the granary gate. Whoever leads them is answerable for every measure that reaches the army, and for every measure that does not.",
  trigger: { type: "year", at: ANCHOR_YEAR },
  when: demo({ kind: "convoy", stage: "muster" }),
  evidence: "fictional",
  sourceIds: [],
  choices: [
    setOut("convoy-set-out", "Set out as you are", "You check the loads once and take the road.", []),
    setOut("convoy-set-out-provisioned", `Buy extra provisions first (${DEMO_CONFIG.service.provisionsCost} dr)`,
      "You pay for extra bread, water skins and spare harness before you leave.", provisions, canProvision),
    setOut("convoy-set-out-with-friend", "Ask someone you trust to ride along",
      "A friend agrees to ride beside the carts and keep watch.", [convoy("companion")], hasCompanion),
    setOut("convoy-set-out-prepared", `Buy provisions and ask a friend to ride along (${DEMO_CONFIG.service.provisionsCost} dr)`,
      "You pay for extra provisions, and a friend rides beside the carts.", [...provisions, convoy("companion")], { type: "all", conditions: [canProvision, hasCompanion] }),
    { id: "convoy-decline", text: "Decline the convoy", outcomes: [{ id: "convoy-decline-result", weight: 1,
      text: "You hand the carts back. The grain stays where it was, and people remember who would not go.", effects: [convoy("withdraw")] }] },
  ],
};

// ── The road (the key decision) ─────────────────────────────────────────────

const injury = (condition: "infected-wound" | "open-leg-fracture"): Effect => ({ type: "condition", condition });
const distinction: Effect = { type: "accomplishment", achievement: CONVOY_DISTINCTION };

const PUSH_THROUGH: Outcome[] = [
  { id: "convoy-push-clean", weight: 5, text: "The carts roll through without trouble.", effects: [convoy("resolve", 0)], weightModifiers: [
    { when: warfare(CONVOY_THRESHOLDS.trainedWarfare), multiplier: 2, reason: RISK_REASONS.trained },
    { when: goodHealth, multiplier: 1.4, reason: RISK_REASONS.health },
    { when: road("dangerous"), multiplier: 0.4, reason: RISK_REASONS.dangerous },
    { when: road("uneasy"), multiplier: 0.7, reason: RISK_REASONS.uneasy },
  ] },
  { id: "convoy-push-skirmish", weight: 3, text: "Raiders cut loose two carts before you drive them off.", effects: [convoy("resolve", 1500)] },
  { id: "convoy-push-ambush", weight: 2, text: "An ambush in a narrow cut scatters the carts. You are hurt, and much of the grain is gone.",
    effects: [convoy("resolve"), injury("infected-wound")], weightModifiers: [
      { when: road("dangerous"), multiplier: 2.5, reason: RISK_REASONS.dangerous },
      { when: road("uneasy"), multiplier: 1.5, reason: RISK_REASONS.uneasy },
      { when: warfare(CONVOY_THRESHOLDS.trainedWarfare), multiplier: 0.4, reason: RISK_REASONS.trained },
      { when: goodHealth, multiplier: 0.7, reason: RISK_REASONS.health },
    ] },
];

const LONG_ROAD: Outcome[] = [
  { id: "convoy-long-safe", weight: 7, text: "The long road is slow and some grain spoils in the heat, but no one troubles you.", effects: [convoy("resolve", 1000)],
    weightModifiers: [{ when: reckoning, multiplier: 1.5, reason: RISK_REASONS.reckoning }] },
  { id: "convoy-long-raided", weight: 2, text: "Even on the long road, raiders find the carts at a well.", effects: [convoy("resolve", 3000)], weightModifiers: [
    { when: road("dangerous"), multiplier: 2, reason: RISK_REASONS.dangerous },
    { when: warfare(CONVOY_THRESHOLDS.trainedWarfare), multiplier: 0.5, reason: RISK_REASONS.trained },
  ] },
];

const GUARD: Outcome[] = [
  { id: "convoy-guard-held", weight: 5, text: "You close the carts into a ring each night. Nothing is taken.", effects: [convoy("resolve", 0)], weightModifiers: [
    { when: warfare(CONVOY_THRESHOLDS.veteranWarfare), multiplier: 2, reason: RISK_REASONS.veteran },
    { when: goodHealth, multiplier: 1.3, reason: RISK_REASONS.health },
  ] },
  { id: "convoy-guard-wounded", weight: 3, text: "You fight off a night raid and lose one cart, but take a wound that festers.",
    effects: [convoy("resolve", 1000), injury("infected-wound")], weightModifiers: [{ when: goodHealth, multiplier: 0.6, reason: RISK_REASONS.health }] },
  { id: "convoy-guard-overrun", weight: 2, text: "Too many raiders come at once. Your leg is broken in the struggle and much of the grain is lost.",
    effects: [convoy("resolve"), injury("open-leg-fracture")], weightModifiers: [
      { when: road("dangerous"), multiplier: 2, reason: RISK_REASONS.dangerous },
      { when: warfare(CONVOY_THRESHOLDS.veteranWarfare), multiplier: 0.4, reason: RISK_REASONS.veteran },
    ] },
];

const LEAD: Outcome[] = [
  { id: "convoy-lead-through", weight: 6,
    text: "You lead the escort through the worst of the road and every cart arrives. Dion enters the convoy in the unit's record with your name at its head.",
    effects: [convoy("resolve", 0), distinction], weightModifiers: [
      { when: warfare(60), multiplier: 1.5, reason: RISK_REASONS.veteran },
      { when: goodHealth, multiplier: 1.3, reason: RISK_REASONS.health },
    ] },
  { id: "convoy-lead-hard-fight", weight: 3,
    text: "You hold the escort together through a hard fight. A few carts are lost and you are wounded, but Dion records that the convoy came through under your lead.",
    effects: [convoy("resolve", 1500), injury("infected-wound"), distinction] },
  { id: "convoy-lead-overrun", weight: 2, text: "The escort breaks under a heavy attack. Your leg is broken and half the grain is lost.",
    effects: [convoy("resolve"), injury("open-leg-fracture")], weightModifiers: [{ when: warfare(60), multiplier: 0.5, reason: RISK_REASONS.veteran }] },
];

const ROAD: LifeEvent = {
  id: CONVOY_ROAD_EVENT_ID,
  title: "On the supply road",
  text: "Two days out, the road narrows between dunes and broken walls. How you take the next stretch decides how much grain reaches the army.",
  trigger: { type: "year", at: ANCHOR_YEAR },
  when: demo({ kind: "convoy", stage: "road" }),
  evidence: "fictional",
  sourceIds: [],
  choices: [
    { id: "convoy-push-through", text: "Push straight through", outcomes: PUSH_THROUGH },
    { id: "convoy-long-road", text: "Take the long road (slower; some grain spoils)", outcomes: LONG_ROAD },
    { id: "convoy-guard-cargo", text: "Close ranks and guard the cargo", when: warfare(CONVOY_THRESHOLDS.guardWarfare), outcomes: GUARD },
    { id: "convoy-lead-escort", text: "Lead the escort through the danger",
      when: { type: "all", conditions: [{ type: "job", job: "soldier" }, road("dangerous"), warfare(DEMO_CONFIG.service.distinctionMinWarfare)] }, outcomes: LEAD },
    { id: "convoy-give-up-cargo", text: "Leave part of the cargo behind to get away", outcomes: [
      { id: "convoy-give-up-result", weight: 1, text: "You cut loose the slowest carts and the rest get away.", effects: [convoy("resolve", 3500)] },
    ] },
  ],
};

// ── Legacy ──────────────────────────────────────────────────────────────────

const SERVICE_ROUTE: LegacyRouteDefinition = {
  id: SERVICE_ROUTE_ID,
  title: "Service",
  description: "Bring the army's grain through on the supply road and have your lead entered in the unit's record.",
  skillIds: ["warfare"],
  jobIds: ["soldier"],
  achievementIds: [CONVOY_DISTINCTION],
};

const DISTINCTION: LegacyAchievementDefinition = {
  id: CONVOY_DISTINCTION,
  routeId: SERVICE_ROUTE_ID,
  title: "Convoy distinction",
  kind: "prestige",
  nameTemplate: "{name}'s Convoy Commendation",
  people: ["Dion"],
  description: "Dion records that you led an escort of army grain through a dangerous road and brought it in.",
  evidence: "fictional",
  sourceIds: [],
};

export const SERVICE_CONTENT: DemoContent = {
  replaceJobs: [SOLDIER],
  events: [MUSTER, ROAD],
  routes: [SERVICE_ROUTE],
  achievements: [DISTINCTION],
};
