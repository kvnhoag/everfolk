/**
 * The stages of a life as the player sees them: five long stages with clear turning ages (school age, coming of age,
 * adulthood at 18, old age). The world's finer stages still decide who makes which decisions; those moments show as
 * unlocks inside these stages. Pure.
 */

export interface LifePhase { id: string; title: string; fromAge: number; toAge: number | null; todo: string }

export const LIFE_PHASES: readonly LifePhase[] = [
  { id: "early-years", title: "Early years", fromAge: 0, toAge: 5,
    todo: "Your family decides for you. From age 3 you answer small turning points yourself. Press Resume and let the first years pass." },
  { id: "childhood", title: "Childhood", fromAge: 6, toAge: 11,
    todo: "Pick a focus (Study is a good start) and spend your yearly action every year. The market opens to you during these years." },
  { id: "youth", title: "Youth", fromAge: 12, toAge: 17,
    todo: "Take your first work and practise the trade you want to grow into. From 16 the household's decisions, fields included, are yours." },
  { id: "adulthood", title: "Adulthood", fromAge: 18, toAge: 59,
    todo: "Work, court, marry and build your household. Reaching 18 earns a card pack." },
  { id: "later-life", title: "Later life", fromAge: 60, toAge: null,
    todo: "Health fades with age: rest, care for family and secure your legacy." },
];

export function lifePhaseAt(age: number): LifePhase {
  return [...LIFE_PHASES].reverse().find(phase => age >= phase.fromAge) ?? LIFE_PHASES[0];
}
