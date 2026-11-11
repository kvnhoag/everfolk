/**
 * Track E — community works, the benefactor route and reputation-gated opportunities.
 *
 * Award design: the benefactor accomplishment is earned by a separate, free "dedicate" activity that becomes
 * available as soon as a work is built (it does not use the year's major activity, so it can follow the final
 * build step in the same year). The shared condition set has no "progress == needed − 1" test and Effects cannot
 * be conditional inside an outcome, so gating on `built` is the only exact signal that needs no contract change;
 * it also keeps the award on the engine's normal accomplishment path (activity provenance, journal line).
 */
import type { CharacterActivity, Condition, Effect, LegacyAchievementDefinition, LegacyRouteDefinition, LifeEvent } from "../../types.ts";
import type { DemoCondition, DemoEffect, WorkId } from "../types.ts";
import type { DemoContent } from "./types.ts";
import { DEMO_CONFIG } from "../config.ts";
import { FARMING_SKILL, WORKS } from "../types.ts";
import { workUseCost } from "../works.ts";

export const BENEFACTOR_ROUTE = "benefactor";
export const BENEFACTOR_FIRST_WORK = "benefactor-first-work";
export const BENEFACTOR_PRESTIGE = "benefactor-prestige";
export const DEDICATE_ACTIVITY = "dedicate-community-work";
export const HONOUR_ACTIVITY = "honour-district-benefactor";
export const BUILD_MIN_AGE = 18;
export const buildActivityId = (work: WorkId): string => `build-${work}`;

const thresholds = DEMO_CONFIG.works.opportunityReputation ?? { neighbours: 30, dispute: 40, envoy: 50 };

const demo = (condition: DemoCondition): Condition => ({ type: "demo", condition });
const demoEffect = (effect: DemoEffect): Effect => ({ type: "demo", effect });
const all = (...conditions: Condition[]): Condition => ({ type: "all", conditions });
const any = (...conditions: Condition[]): Condition => ({ type: "any", conditions });
const not = (condition: Condition): Condition => ({ type: "not", condition });
const built = (work: WorkId): Condition => demo({ kind: "work", work, built: true });
const reputationAtLeast = (value: number): Condition => demo({ kind: "reputation", op: "gte", value });
const adultFrom = (age: number): Condition => ({ type: "age", op: "gte", value: age });

const BUILD_TEXT: Record<WorkId, { text: string; category: CharacterActivity["category"]; outcome: string }> = {
  well: { text: "Help build a village well", category: "family",
    outcome: "You pay the well-diggers and send grain to feed them while they cut down through the silt toward clean water." },
  granary: { text: "Help build a village granary", category: "career",
    outcome: "You pay the brickmakers and send grain for the crew raising the village granary's walls above the flood line." },
  school: { text: "Help build a village school", category: "family",
    outcome: "You pay the builders of a schoolroom by the shrine and send grain to feed the teacher who will keep it." },
  "healing-house": { text: "Help build a healing house at the shrine", category: "family",
    outcome: "You pay the builders of a healing house at the shrine and send grain for the attendants who will tend the sick." },
};

function buildActivity(work: WorkId): CharacterActivity {
  const cost = workUseCost(DEMO_CONFIG, work);
  const copy = BUILD_TEXT[work];
  return {
    id: buildActivityId(work), text: copy.text, category: copy.category, minAge: BUILD_MIN_AGE,
    when: all(
      demo({ kind: "head-of-plot", value: true }),
      demo({ kind: "work", work, built: false }),
      demo({ kind: "item", item: "grain", op: "gte", value: cost.grain }),
    ),
    outcomes: [{
      id: `${buildActivityId(work)}-season`,
      text: `${copy.outcome} This season's share costs ${cost.cash} drachmas and ${cost.grain} measures of grain.`,
      weight: 1,
      effects: [
        { type: "cash", delta: -cost.cash },
        demoEffect({ kind: "grain", delta: -cost.grain, cause: "community work" }),
        demoEffect({ kind: "work", work, progress: 1 }),
      ],
    }],
  };
}

const anyBuilt = any(...WORKS.map(built));
const twoBuilt = any(...WORKS.flatMap((first, i) => WORKS.slice(i + 1).map(second => all(built(first), built(second)))));

const DEDICATE: CharacterActivity = {
  id: DEDICATE_ACTIVITY, text: "Dedicate your finished work to the village", category: "family",
  minAge: BUILD_MIN_AGE, usesYearlyActivity: false,
  when: all(anyBuilt, not({ type: "accomplishment", achievement: BENEFACTOR_FIRST_WORK })),
  outcomes: [{
    id: `${DEDICATE_ACTIVITY}-done`,
    text: "Harpocras, the village scribe, cuts your name into the dedication stone. Thaesis, the first neighbour to use the work, tells her children who paid for it.",
    weight: 1,
    effects: [{ type: "accomplishment", achievement: BENEFACTOR_FIRST_WORK }],
  }],
};

const HONOUR: CharacterActivity = {
  id: HONOUR_ACTIVITY, text: "Accept the district's thanks for your public works", category: "family",
  minAge: BUILD_MIN_AGE, usesYearlyActivity: false,
  when: all(twoBuilt, { type: "accomplishment", achievement: BENEFACTOR_FIRST_WORK }, not({ type: "accomplishment", achievement: BENEFACTOR_PRESTIGE })),
  outcomes: [{
    id: `${HONOUR_ACTIVITY}-done`,
    text: "Heraclides, the district's royal scribe, enters both works under your name in the district register and reads the entry aloud at the shrine festival.",
    weight: 1,
    effects: [{ type: "accomplishment", achievement: BENEFACTOR_PRESTIGE }],
  }],
};

const ROUTE: LegacyRouteDefinition = {
  id: BENEFACTOR_ROUTE, title: "Benefactor",
  description: "Pay for a well, granary, school or healing house the village needs, then for a second work the district relies on.",
  skillIds: [FARMING_SKILL, "reckoning"], jobIds: ["tenant-farmer", "grain-dealer"],
  achievementIds: [BENEFACTOR_FIRST_WORK, BENEFACTOR_PRESTIGE],
};

const ACHIEVEMENTS: LegacyAchievementDefinition[] = [
  { id: BENEFACTOR_FIRST_WORK, routeId: BENEFACTOR_ROUTE, title: "A work for the village", kind: "ordinary",
    nameTemplate: "{name}'s Gift to the Village", people: ["Harpocras", "Thaesis"],
    description: "Harpocras cuts your name into the dedication stone. Thaesis tells her children who paid for the work.",
    evidence: "fictional", sourceIds: [] },
  { id: BENEFACTOR_PRESTIGE, routeId: BENEFACTOR_ROUTE, title: "Benefactor of the district", kind: "prestige",
    nameTemplate: "{name}, Benefactor of the District", people: ["Heraclides"],
    description: "Heraclides enters two public works under your name in the district register.",
    evidence: "fictional", sourceIds: [] },
];

const EVENTS: LifeEvent[] = [
  {
    id: "neighbours-help-at-harvest", title: "Neighbours at the harvest",
    text: "Neighbours who know what you have done for the village come with sickles and donkeys to help bring in your harvest.",
    trigger: { type: "random", weight: 2 }, maxOccurrences: 3, cooldownYears: 6, evidence: "fictional", sourceIds: [],
    when: all(adultFrom(BUILD_MIN_AGE), demo({ kind: "head-of-plot", value: true }), reputationAtLeast(thresholds.neighbours)),
    choices: [
      { id: "neighbours-help-accept", text: "Accept their help and feed them at the harvest table", outcomes: [{
        id: "neighbours-help-accept-result", weight: 1,
        text: "With more hands the grain is cut before it can shed. Next harvest should come in fuller, and the evening meal is loud.",
        effects: [demoEffect({ kind: "harvest-bonus", bps: 1000 }), { type: "stat", stat: "bonds", delta: 2 }],
      }] },
      { id: "neighbours-help-decline", text: "Thank them and bring the harvest in yourselves", outcomes: [{
        id: "neighbours-help-decline-result", weight: 1,
        text: "You send them home with thanks and work the field yourselves from dawn to dark.",
        effects: [{ type: "skill", skill: FARMING_SKILL, delta: 2 }, { type: "stat", stat: "health", delta: -1 }],
      }] },
    ],
  },
  {
    id: "asked-to-settle-dispute", title: "A boundary dispute",
    text: "Two neighbouring families quarrel over where one plot ends after the flood moved the markers. Both ask you to decide.",
    trigger: { type: "random", weight: 1 }, maxOccurrences: 2, cooldownYears: 8, evidence: "fictional", sourceIds: [],
    when: all(adultFrom(25), reputationAtLeast(thresholds.dispute)),
    choices: [
      { id: "settle-dispute-hear", text: "Hear both sides at the threshing floor", outcomes: [{
        id: "settle-dispute-hear-result", weight: 1,
        text: "You pace the field with both families and set new markers. Both grumble, and both accept it.",
        effects: [{ type: "skill", skill: "oratory", delta: 2 }, demoEffect({ kind: "reputation", delta: 2 })],
      }] },
      { id: "settle-dispute-refuse", text: "Send them to the village scribe", outcomes: [{
        id: "settle-dispute-refuse-result", weight: 1,
        text: "You say it is not your place. The families go to the scribe, and some neighbours think less of you for it.",
        effects: [demoEffect({ kind: "reputation", delta: -1 })],
      }] },
    ],
  },
  {
    id: "steward-visits-benefactor", title: "A steward from the revenue office",
    text: "A steward from Cleomenes' revenue office stops at your door. He has heard of the work you paid for and wants an honest account of the district's harvest.",
    trigger: { type: "random", weight: 2 }, maxOccurrences: 1, evidence: "fictional", sourceIds: [],
    when: all(adultFrom(BUILD_MIN_AGE), anyBuilt, reputationAtLeast(thresholds.envoy)),
    choices: [
      { id: "steward-report", text: "Report the district's harvest for his fee", outcomes: [{
        id: "steward-report-result", weight: 1,
        text: "You walk the steward through the fields and the stores. He pays you 60 drachmas for the report.",
        effects: [{ type: "cash", delta: 60 }, { type: "skill", skill: "reckoning", delta: 3 }],
      }] },
      { id: "steward-plead", text: "Ask him to go easy on the village's grain", outcomes: [{
        id: "steward-plead-result", weight: 1,
        text: "The steward promises nothing, but your neighbours hear that you spoke for them.",
        effects: [demoEffect({ kind: "reputation", delta: 3 }), { type: "stat", stat: "bonds", delta: 1 }],
      }] },
    ],
  },
];

export const WORKS_CONTENT: DemoContent = {
  activities: [...WORKS.map(buildActivity), DEDICATE, HONOUR],
  routes: [ROUTE],
  achievements: ACHIEVEMENTS,
  events: EVENTS,
};
