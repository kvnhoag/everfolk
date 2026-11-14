import { useMemo } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import {
  dashboardColumns, newGuidedStep, sectionAges, sectionFacts, tipsPassedOnEntry, visibleSections,
  type DashboardColumnLayout, type DashboardColumnOptions, type GameSection, type SectionAges, type SectionFacts,
} from "../models/onboarding-sections.ts";
import type { TutorialHintId } from "../models/tutorial-hints.ts";
import { guidePointerDue } from "../models/year-guide.ts";
import { guidePointers } from "../state/guide-pointers.ts";
import { tutorialStore } from "../state/tutorial-store.ts";

export interface LifeSections {
  ages: SectionAges;
  facts: SectionFacts;
  sections: ReadonlySet<GameSection>;
  /** The section is drawn at this age. */
  shows(id: GameSection): boolean;
  /** Column placement and visibility for the dashboard's current life stage. */
  columns(options: DashboardColumnOptions): DashboardColumnLayout;
  /** Tips whose stage passed before this year (for a save entered mid-life). */
  passed: TutorialHintId[];
}

/** The life screen's sections for this life and age; recomputed only when the facts that drive them change. */
export function useLifeSections(world: WorldPack, life: LifeState): LifeSections {
  const ages = useMemo(() => sectionAges(world, life), [world, life.originId]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = sectionFacts(world, life);
  const factsKey = JSON.stringify(now);
  return useMemo(() => {
    const sections = visibleSections(now, ages);
    return {
      ages, facts: now, sections,
      shows: (id: GameSection) => sections.has(id),
      columns: (options: DashboardColumnOptions) => dashboardColumns(sections, options),
      passed: tipsPassedOnEntry(now, ages),
    };
  }, [factsKey, ages]); // eslint-disable-line react-hooks/exhaustive-deps
}

export interface TeachingStopInput {
  world: WorldPack;
  sections: ReadonlySet<GameSection>;
  lifeKey: string;
  focusChosen: boolean;
  persistent: boolean;
}

/**
 * For Next decision while tips are on: stop at the first skipped year where a new section opens with an unseen tip,
 * or where a step the player has not tried yet would be pointed at. Reads the tutorial's seen tips at click time.
 */
export function teachingStop({ world, sections, lifeKey, focusChosen, persistent }: TeachingStopInput): (next: LifeState) => boolean {
  const seen = tutorialStore.getSnapshot().seen;
  const pointed = guidePointers.read(lifeKey, persistent);
  return next => {
    const after = visibleSections(sectionFacts(world, next), sectionAges(world, next));
    return newGuidedStep(sections, after, seen) !== null
      || guidePointerDue({ life: next, world, focusChosen, visitUsed: false, tipsOn: true, pointed });
  };
}
