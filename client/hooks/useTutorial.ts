import { useEffect, useRef, useSyncExternalStore } from "react";
import type { TutorialState } from "../models/tutorial-navigation.ts";
import { tutorialStore, type TutorialNavigator } from "../state/tutorial-store.ts";

/** The tour's current state. Closed during server rendering. */
export function useTutorial(): TutorialState {
  return useSyncExternalStore(tutorialStore.subscribe, tutorialStore.getSnapshot, tutorialStore.getServerSnapshot);
}

/**
 * Lets a screen open itself for tour steps. The latest handler is always used, so it may read
 * fresh component state without re-registering on every render.
 */
export function useTutorialNavigator(navigator: TutorialNavigator): void {
  const latest = useRef(navigator);
  latest.current = navigator;
  useEffect(() => tutorialStore.registerNavigator(screen => latest.current(screen)), []);
}
