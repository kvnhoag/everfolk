/** Track A — farming occupations and training for the demo world. Jobs themselves live in the base content. */
import type { CharacterActivity, Condition } from "../../types.ts";
import type { DemoContent } from "./types.ts";
import { FARMING_SKILL } from "../types.ts";

const notJob = (job: string): Condition => ({ type: "not", condition: { type: "job", job } });
const atLeast = (skill: string, value: number): Condition => ({ type: "skill", skill, op: "gte", value });

const FARMING_ACTIVITIES: CharacterActivity[] = [
  {
    id: "work-farmhand", text: "Take up work on the household plot", category: "career", minAge: 12, cooldownYears: 1,
    when: { type: "all", conditions: [notJob("farmhand"), notJob("tenant-farmer"), notJob("grain-dealer")] },
    outcomes: [{ id: "work-farmhand-result", weight: 1,
      text: "You join the work on the household plot: carrying water, weeding and helping bring in the harvest.",
      effects: [{ type: "job", job: "farmhand" }, { type: "flag", flag: "retired", value: false }, { type: "skill", skill: FARMING_SKILL, delta: 1 }] }],
  },
  {
    id: "work-tenant-farmer", text: "Run the plot as a tenant farmer", category: "career", minAge: 16, cooldownYears: 1,
    when: { type: "all", conditions: [notJob("tenant-farmer"), atLeast(FARMING_SKILL, 15)] },
    outcomes: [{ id: "work-tenant-farmer-result", weight: 1,
      text: "You agree the tenancy with the landowner's steward. The rent is fixed as a share of each harvest, and the plot is yours to run.",
      effects: [{ type: "job", job: "tenant-farmer" }, { type: "flag", flag: "retired", value: false }] }],
  },
  {
    id: "work-grain-dealer", text: "Set up as a grain dealer", category: "career", minAge: 20, cooldownYears: 1,
    when: { type: "all", conditions: [notJob("grain-dealer"), atLeast(FARMING_SKILL, 30), atLeast("reckoning", 25),
      { type: "cash", op: "gte", value: 20 }, { type: "demo", condition: { kind: "item", item: "grain", op: "gte", value: 300 } }] },
    outcomes: [{ id: "work-grain-dealer-result", weight: 1,
      text: "You buy measures and sacks, enlarge the store and start buying and selling grain on your own account.",
      effects: [{ type: "job", job: "grain-dealer" }, { type: "flag", flag: "retired", value: false }, { type: "stat", stat: "wealth", delta: -2 }] }],
  },
  {
    id: "train-farming", text: "Learn field work from an older farmer", category: "training", minAge: 8, cooldownYears: 1,
    when: { type: "skill", skill: FARMING_SKILL, op: "lt", value: 100 },
    outcomes: [{ id: "train-farming-result", weight: 1,
      text: "An older farmer shows you how to read the soil after the flood, sow evenly and keep the channels clear.",
      effects: [{ type: "skill", skill: FARMING_SKILL, delta: 5 }, { type: "stat", stat: "health", delta: -1 }] }],
  },
];

export const FARMING_CONTENT: DemoContent = {
  skills: {
    [FARMING_SKILL]: { label: "Farming", min: 0, max: 100, initial: 0, description: "Working land: ploughing, sowing, watering and harvest.",
      branch: "Land", tier: 1, trainingActivity: "train-farming" },
  },
  activities: FARMING_ACTIVITIES,
};
