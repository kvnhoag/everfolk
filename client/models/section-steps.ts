/**
 * The order to read the game screen in. The same numbers appear on the How to Play page, on the "This year"
 * checklist and as a badge on each section, so a new player always knows what to look at next.
 */

export const SECTION_STEPS = ["time", "focus", "action", "household", "town", "record"] as const;
export type SectionStepId = typeof SECTION_STEPS[number];

/** 1-based step number of a section. */
export function sectionStep(id: SectionStepId): number {
  return SECTION_STEPS.indexOf(id) + 1;
}

/** Where each section is drawn, as selector alternatives (a locked placeholder stands in until it opens). */
export const SECTION_TARGETS: Record<SectionStepId, readonly string[]> = {
  time: [".life-session-bar"],
  focus: [".yearly-focus", ".section-locked[data-step='focus']"],
  action: [".life-yearly-action-deck", ".section-locked[data-step='action']"],
  household: [".aoe-resource-hud"],
  town: [".demo-economy"],
  record: [".life-record-panel"],
};

export const SECTION_TITLES: Record<SectionStepId, string> = {
  time: "Time",
  focus: "Focus",
  action: "Yearly action",
  household: "Household",
  town: "Market & town",
  record: "Life record",
};
