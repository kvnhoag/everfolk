/**
 * Pacing for the new free-play world, measured with the focused-play cohort
 * (scripts/skills/evaluate-focus.mjs, 100 lives per path). The user's band: every path 45–65%.
 * A path's rate is about the chance of surviving to the end of its schedule, so proof years are
 * the lever. Retained worlds keep their original years.
 */
import type { WorldPack } from "../types.ts";
import { MILITARY_QUALIFICATIONS } from "../capabilities/military.ts";

export const PROOF_YEARS: Record<string, number> = {
  // Clothing (74%) and Cultivation (66%) finished early, around 39 and 41: one more year per step.
  AT5: 3, AT6: 3, AT7: 3, AT8: 3, AT9: 3,
  FC6: 3, FC7: 3, FC9: 3,
  // The military lane (0%): officers came near 50. One proof year per step lets a soldier command by about 35.
  B2: 1, B3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1,
};

/** The military path's skill levels, about a quarter lower, so service years and steps line up. */
export const SKILL_GATES: Record<string, Record<string, number>> = {
  B2: { strength: 6 }, B3: { strength: 10, endurance: 12 },
  M4: { strength: 12, endurance: 12, warfare: 10, literacy: 6 }, // warfare 10 matches the enlistment requirement
  M5: { warfare: 18, endurance: 18 },
  M6: { warfare: 24, reckoning: 14, literacy: 12 },
  M7: { warfare: 30, oratory: 16, strength: 18, endurance: 22 },
  M8: { warfare: 36, oratory: 20, reckoning: 16 },
  M9: { warfare: 44, literacy: 22, oratory: 22 },
  M10: { warfare: 54, oratory: 28, strength: 30, endurance: 34 },
};

/** Appointment odds: an officer's commission used to need about seven tries three years apart. */
const APPOINTMENTS: Record<string, { cooldownYears: number; weights: Record<string, number> }> = {
  "seek-officer-commission": { cooldownYears: 2, weights: { "officer-appointed": 40, "officer-refused": 60 } },
};

export function applyPacing(world: WorldPack): void {
  for (const activity of world.character?.activities ?? []) {
    const odds = APPOINTMENTS[activity.id];
    if (!odds) continue;
    activity.cooldownYears = odds.cooldownYears;
    activity.outcomes = activity.outcomes.map(outcome => ({ ...outcome, weight: odds.weights[outcome.id] ?? outcome.weight }));
  }
  for (const node of world.capabilities?.nodes ?? []) {
    if (SKILL_GATES[node.id]) node.minimumProficiency = { ...node.minimumProficiency, ...SKILL_GATES[node.id] };
    const years = PROOF_YEARS[node.id];
    if (years === undefined) continue;
    node.proofYears = years;
    node.proof = node.proof.replace(/\b2\b/, String(years));
  }
  // A rank asks for the skills of its qualification, so the two stay the same.
  for (const job of world.character?.jobs ?? []) {
    const qualification = world.capabilities?.nodes.find(node => node.id === MILITARY_QUALIFICATIONS[job.id]);
    if (qualification) job.requirements = { ...qualification.minimumProficiency };
  }
}
