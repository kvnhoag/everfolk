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
