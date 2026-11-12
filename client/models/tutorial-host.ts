/**
 * Which open modal window the tour card lives in. A modal window makes everything outside it inert, so a
 * card left outside could not be clicked; a card inside the topmost window stays usable and freezes nothing.
 */
export function nextHostStack<T>(stack: readonly T[], host: T, open: boolean, eligible = true): T[] {
  const without = stack.filter(item => item !== host);
  return open && eligible ? [...without, host] : without;
}

export function topTutorialHost<T>(stack: readonly T[]): T | null {
  return stack.length ? stack[stack.length - 1] : null;
}
