import type { Choice } from "../../../src/types.ts";

/** Keep a success selection attached to the outcome when an author renames it. */
export function renameChoiceOutcome(choice: Choice, index: number, id: string): Choice {
  const previousId = choice.outcomes[index].id;
  return {
    ...choice,
    outcomes: choice.outcomes.map((outcome, position) => position === index ? { ...outcome, id } : outcome),
    ...(choice.opportunity ? { opportunity: { ...choice.opportunity, outcomeIds: choice.opportunity.outcomeIds.map(value => value === previousId ? id : value) } } : {}),
  };
}

/** A chance preview needs both a success and a failure after removing a branch. */
export function removeChoiceOutcome(choice: Choice, index: number): Choice {
  const outcomes = choice.outcomes.filter((_, position) => position !== index);
  const { opportunity, ...base } = choice;
  const outcomeIds = opportunity?.outcomeIds.filter(id => outcomes.some(outcome => outcome.id === id));
  return {
    ...base,
    outcomes,
    ...(opportunity && outcomeIds?.length && outcomeIds.length < outcomes.length ? { opportunity: { ...opportunity, outcomeIds } } : {}),
  };
}
