/** Advance a historical calendar without introducing a year zero. */
export function yearAtAge(startYear: number, age: number): number {
  const astronomicalStart = startYear < 0 ? startYear + 1 : startYear;
  const astronomicalYear = astronomicalStart + age;
  return astronomicalYear <= 0 ? astronomicalYear - 1 : astronomicalYear;
}

export function formatYear(year: number): string {
  if (!Number.isSafeInteger(year) || year === 0) throw new Error("Year must be a nonzero safe integer.");
  return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
}

/** The year a life was born: its own birth year where the world varies births, else the world's start year. */
export function birthYearOf(world: { startYear: number }, life: { birthYear?: number }): number {
  return life.birthYear ?? world.startYear;
}
