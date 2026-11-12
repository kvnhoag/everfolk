/**
 * Pacing for the new free-play world, measured with the focused-play cohort
 * (scripts/skills/evaluate-focus.mjs, 100 lives per path). The user's band: every path 45–65%.
 * A path's rate is about the chance of surviving to the end of its schedule, so proof years are
 * the lever. Retained worlds keep their original years.
 */
import type { WorldPack } from "../types.ts";
import { MILITARY_QUALIFICATIONS } from "../capabilities/military.ts";


/** Fitness and knowledge for the military path: a serving veteran loses health each year, and drill does not keep book-learning fresh. */
export const STAT_GATES: Record<string, Record<string, number>> = {
  M4: { health: 35, knowledge: 4 }, M5: { health: 35 }, M6: { health: 35 }, M7: { health: 35 },
  M8: { health: 35, knowledge: 10 }, M9: { health: 30, knowledge: 12 }, M10: { health: 30, knowledge: 12 },
};

export const PROOF_YEARS: Record<string, number> = {
  // Longer lives (milder illness) pushed every path to 65–80%. With no age rule, the middle steps ask for
  // more years of proven work, most on the paths that finished earliest. Depth-10 steps are fixed projects.
  FC5: 3, FC6: 5, FC7: 5, FC9: 5, FC10: 4,   // FC8 needs two different crops, so it stays at two
  FR5: 4, FR6: 4, FR7: 4, FR8: 5,
  AT5: 6, AT6: 6, AT7: 6, AT8: 5, AT9: 5,
  AC5: 6, AC6: 5, AC7: 5, AC8: 5, AC9: 5,
  AS5: 5, AS6: 5, AS7: 5, AS8: 2,
  PS5: 6, PS6: 5, PS7: 4, PS8: 4, PS9: 3,
  PP5: 5, PP6: 5, PP7: 3, PP8: 5,
  T3: 3, T4: 3, T5: 3, T6: 3, T7: 3, T8: 4, T9: 3,
  // The military lane: one proof year per step, so a soldier can command by about 37.
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
  M10: { warfare: 48, oratory: 28, strength: 30, endurance: 30 },
};

/** Appointment odds: an officer's commission used to need about seven tries three years apart. */
const APPOINTMENTS: Record<string, { cooldownYears: number; weights: Record<string, number> }> = {
  "seek-officer-commission": { cooldownYears: 2, weights: { "officer-appointed": 40, "officer-refused": 60 } },
};

export function applyPacing(world: WorldPack): void {
  for (const node of world.capabilities?.nodes ?? []) {
    if (STAT_GATES[node.id]) node.minimumStats = { ...STAT_GATES[node.id] };
  }
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
    node.proof = /^Complete \d+\b/.test(node.proof) ? node.proof.replace(/^Complete \d+\b/, `Complete ${years}`) : `${node.proof} (${years} proof years)`;
  }
  // A rank asks for the skills of its qualification, so the two stay the same.
  for (const job of world.character?.jobs ?? []) {
    const qualification = world.capabilities?.nodes.find(node => node.id === MILITARY_QUALIFICATIONS[job.id]);
    if (qualification) job.requirements = { ...qualification.minimumProficiency };
  }
}
