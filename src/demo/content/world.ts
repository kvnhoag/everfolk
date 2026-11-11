/** Track D — the demo world's base content: rural origins, the flood and levy decisions, figure deeds. */
import type { Condition, Effect, LifeEvent, Origin } from "../../types.ts";
import type { DemoCondition, DemoEffect } from "../types.ts";
import type { DemoContent } from "./types.ts";

/** Year anchor for condition-gated decisions: the world's first year, so the trigger is always past. */
const ALWAYS = -350;
const RECURRING = 10;

/** Key decision ids for NFT draws (workflow 3). `convoyRoad` comes from Track C's content. */
export const DEMO_KEY_EVENTS = { flood: "flood-failure", levy: "levy-call" } as const;

const demo = (condition: DemoCondition): Condition => ({ type: "demo", condition });
const act = (effect: DemoEffect): Effect => ({ type: "demo", effect });
const all = (...conditions: Condition[]): Condition => ({ type: "all", conditions });
const age = (op: "gte" | "lte", value: number): Condition => ({ type: "age", op, value });

// ── Origins: every birth is into a household with land ──────────────────────

const ORIGINS: Origin[] = [
  {
    id: "tenant-farming-household",
    title: "A tenant-farming household",
    text: "You are born into a family cultivating a rented plot beside the western Delta. They pay the landlord a share of each harvest and sell what is left near Rhakotis. Relatives take turns watching you while the adults work the fields.",
    weight: 7,
    statRanges: { health: { min: 61, max: 83 }, knowledge: { min: 0, max: 2 }, wealth: { min: 0, max: 7 }, bonds: { min: 60, max: 85 } },
    effects: [], evidence: "fictional", sourceIds: ["household-farming-context", "classical-rhakotis"],
  },
  {
    id: "soldier-household",
    title: "A garrison family",
    text: "You are born into a family supported partly by a relative's military service. Like other soldiers' families, they hold a small plot of land near the coastal road and farm it between postings. Family and neighbors share your care when service keeps an adult away.",
    weight: 5,
    statRanges: { health: { min: 62, max: 84 }, knowledge: { min: 0, max: 3 }, wealth: { min: 4, max: 16 }, bonds: { min: 50, max: 79 } },
    effects: [], evidence: "fictional", sourceIds: ["household-late-period", "classical-rhakotis"],
  },
  {
    id: "estate-household",
    title: "A landowning estate household",
    text: "You are born into a family that owns fields and storage buildings near the coast. The household works its own plot and keeps grain in its storerooms. A caregiver stays with you while adults check supplies and rents.",
    weight: 3,
    statRanges: { health: { min: 61, max: 83 }, knowledge: { min: 0, max: 4 }, wealth: { min: 25, max: 60 }, bonds: { min: 48, max: 75 } },
    effects: [], evidence: "fictional", sourceIds: ["household-late-period", "household-farming-context", "classical-rhakotis"],
  },
  {
    id: "delta-newcomers",
    title: "Newcomers from the Delta",
    text: "You are born near Rhakotis after your family moves from a Delta village. They take up a small rented plot of land beside relatives and work it together. Food and childcare are shared while they settle in.",
    weight: 8,
    statRanges: { health: { min: 62, max: 82 }, knowledge: { min: 0, max: 2 }, wealth: { min: 2, max: 8 }, bonds: { min: 64, max: 84 } },
    effects: [], evidence: "historically-inspired", sourceIds: ["classical-rhakotis", "classical-rhakotis-archaeology"],
  },
];

// ── Key decisions ───────────────────────────────────────────────────────────

const FLOOD_FAILURE: LifeEvent = {
  id: DEMO_KEY_EVENTS.flood,
  title: "The flood fails",
  text: "The Nile stays low through the flood season and the water never reaches the upper fields. The neighbouring farm expects a poor harvest, and the merchant's grain prices are already rising. Your household must decide how to get through the year.",
  trigger: { type: "year", at: ALWAYS },
  when: demo({ kind: "year", family: "flood", level: "low", fresh: true }),
  maxOccurrences: RECURRING,
  evidence: "historically-inspired",
  sourceIds: ["nile-floods", "household-farming-context"],
  choices: [
    {
      id: "flood-ration-keep-seed",
      text: "Cut every portion and keep the seed grain for sowing",
      outcomes: [{
        id: "flood-ration-keep-seed-result",
        text: "Everyone eats less this year, but the seed grain stays in its jars and the whole plot is sown when the water allows.",
        weight: 1,
        effects: [{ type: "stat", stat: "health", delta: -2 }, act({ kind: "harvest-bonus", bps: 1500 })],
      }],
    },
    {
      id: "flood-sell-silver",
      text: "Sell a piece of silver to raise money for grain",
      when: demo({ kind: "item", item: "silver", op: "gte", value: 1 }),
      outcomes: [{
        id: "flood-sell-silver-result",
        text: "A dealer pays 50 drachmas for your silver. The money will buy grain if the store runs short.",
        weight: 1,
        effects: [act({ kind: "item", item: "silver", delta: -1, cause: "sold to buy grain in the flood year" }), { type: "cash", delta: 50 }],
      }],
    },
    {
      id: "flood-sell-linen",
      text: "Sell two bolts of linen to raise money for grain",
      when: demo({ kind: "item", item: "linen", op: "gte", value: 2 }),
      outcomes: [{
        id: "flood-sell-linen-result",
        text: "A dealer pays 40 drachmas for the linen. The money will buy grain if the store runs short.",
        weight: 1,
        effects: [act({ kind: "item", item: "linen", delta: -2, cause: "sold to buy grain in the flood year" }), { type: "cash", delta: 40 }],
      }],
    },
    {
      id: "flood-share-grain",
      text: "Share 100 measures of grain with neighbours who have none",
      when: demo({ kind: "item", item: "grain", op: "gte", value: 300 }),
      outcomes: [{
        id: "flood-share-grain-result",
        text: "You carry baskets of grain to the neighbours whose stores are empty. Your own store is smaller, but the district remembers who helped.",
        weight: 1,
        effects: [act({ kind: "share-grain", quantity: 100 }), act({ kind: "reputation", delta: 5 }), { type: "stat", stat: "bonds", delta: 2 }],
      }],
    },
  ],
};

const LEVY_CALL: LifeEvent = {
  id: DEMO_KEY_EVENTS.levy,
  title: "The levy comes to the district",
  text: "Army officers arrive to raise men and supplies. Every household with someone fit to serve is listed, and the officers will also take provisions or a substitute's fee. Whoever goes, their labour leaves the family plot.",
  trigger: { type: "year", at: ALWAYS },
  when: all(
    demo({ kind: "year", family: "army", level: "recruiting", fresh: true }),
    age("gte", 16),
    { type: "not", condition: { type: "job", job: "soldier" } },
  ),
  maxOccurrences: RECURRING,
  evidence: "historically-inspired",
  sourceIds: ["fischer-bovet-2013-army"],
  choices: [
    {
      id: "levy-stay-on-farm",
      text: "Stay on the farm and keep working the plot",
      outcomes: [{
        id: "levy-stay-on-farm-result",
        text: "You keep working the plot. The officer notes your name, and some neighbours mutter that others went in your place.",
        weight: 1,
        effects: [act({ kind: "reputation", delta: -2 }), { type: "stat", stat: "bonds", delta: 1 }],
      }],
    },
    {
      id: "levy-enlist",
      text: "Enlist as a soldier",
      when: all(age("gte", 18), { type: "skill", skill: "warfare", op: "gte", value: 10 }),
      outcomes: [{
        id: "levy-enlist-result",
        text: "You report to the muster and are enrolled as a soldier. Your labour leaves the family plot while you serve.",
        weight: 1,
        effects: [{ type: "job", job: "soldier" }, { type: "flag", flag: "army-service", value: true }, act({ kind: "reputation", delta: 3 })],
      }],
    },
    {
      id: "levy-drill",
      text: "Report to the muster for drill",
      when: all(age("gte", 18), { type: "skill", skill: "warfare", op: "lt", value: 10 }),
      outcomes: [{
        id: "levy-drill-result",
        text: "The officer finds you too raw for the ranks and sets you to drill with the recruits for a season. You come home knowing the basics.",
        weight: 1,
        effects: [{ type: "skill", skill: "warfare", delta: 5 }, { type: "flag", flag: "army-service", value: true }, { type: "stat", stat: "health", delta: -1 }],
      }],
    },
    {
      id: "levy-send-provisions",
      text: "Send 150 measures of grain to the muster",
      when: demo({ kind: "item", item: "grain", op: "gte", value: 200 }),
      outcomes: [{
        id: "levy-send-provisions-result",
        text: "Your household loads grain onto a cart for the muster. The officer records the gift against your name.",
        weight: 1,
        effects: [act({ kind: "grain", delta: -150, cause: "provisions sent to the army muster" }), act({ kind: "reputation", delta: 4 })],
      }],
    },
    {
      id: "levy-pay-substitute",
      text: "Pay the 60-drachma substitute fee",
      when: { type: "cash", op: "gte", value: 60 },
      outcomes: [{
        id: "levy-pay-substitute-result",
        text: "The officer takes the fee and enters a hired man in your place. Your household keeps its labour on the plot.",
        weight: 1,
        effects: [{ type: "cash", delta: -60 }],
      }],
    },
  ],
};

export const WORLD_CONTENT: DemoContent = {
  origins: ORIGINS,
  removeEvents: ["an-unreliable-season"],
  events: [FLOOD_FAILURE, LEVY_CALL],
};
