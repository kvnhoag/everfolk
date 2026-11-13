import { useEffect, useSyncExternalStore } from "react";
import type { TutorialState } from "../models/tutorial-navigation.ts";
import type { TutorialContext, TutorialView } from "../models/tutorial-triggers.ts";
import { tutorialStore } from "../state/tutorial-store.ts";

/** The tutorial's current state. Closed during server rendering. */
export function useTutorial(): TutorialState {
  return useSyncExternalStore(tutorialStore.subscribe, tutorialStore.getSnapshot, tutorialStore.getServerSnapshot);
}

/** Reports what the game shows, so each hint opens at its stage. Cleared when the game unmounts. */
export function useTutorialGameContext(context: TutorialContext): void {
  const key = JSON.stringify(context);
  useEffect(() => { tutorialStore.setGameContext(JSON.parse(key) as TutorialContext); }, [key]);
  useEffect(() => () => tutorialStore.setGameContext(null), []);
}

/** Reports the Weave screen opened over the game, or null when none is open. */
export function useTutorialChainView(view: TutorialView | null): void {
  useEffect(() => { tutorialStore.setChainView(view); }, [view]);
}
