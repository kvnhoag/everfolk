import { CLOSED_TUTORIAL, tutorialTransition, type TutorialAction, type TutorialState } from "../models/tutorial-navigation.ts";
import { TUTORIAL_STEPS, type TutorialScreen, type TutorialStep } from "../models/tutorial-steps.ts";
import { browserTutorialStorage, hasSeenTutorial, rememberTutorial, type TutorialStorage } from "../storage/tutorial-storage.ts";

export type TutorialNavigator = (screen: TutorialScreen) => void;

export interface TutorialStoreOptions {
  steps: readonly TutorialStep[];
  storage(): TutorialStorage | undefined;
}

/**
 * The tour controller: an external store for useSyncExternalStore plus a registry of screen navigators.
 * Screens (the game, the Weave layer) register how to open themselves; each step change asks them to.
 */
export function createTutorialStore({ steps, storage }: TutorialStoreOptions) {
  let state: TutorialState = CLOSED_TUTORIAL;
  const listeners = new Set<() => void>();
  const navigators = new Set<TutorialNavigator>();

  function navigate(screen: TutorialScreen): void {
    for (const navigator of [...navigators]) {
      try { navigator(screen); }
      catch (error) { console.error("Everfolk tutorial: a screen could not open for this step.", error); }
    }
  }

  function dispatch(action: TutorialAction): void {
    const next = tutorialTransition(state, action, steps.length);
    if (next === state) return;
    const moved = next.open && (next.index !== state.index || next.run !== state.run || !state.open);
    state = next;
    if (!next.open) rememberTutorial(storage(), "closed");
    if (moved) navigate(steps[next.index].screen);
    for (const listener of [...listeners]) listener();
  }

  return {
    getSnapshot: (): TutorialState => state,
    getServerSnapshot: (): TutorialState => CLOSED_TUTORIAL,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    registerNavigator(navigator: TutorialNavigator): () => void {
      navigators.add(navigator);
      return () => { navigators.delete(navigator); };
    },
    start: (index = 0) => dispatch({ type: "start", index }),
    next: () => dispatch({ type: "next" }),
    back: () => dispatch({ type: "back" }),
    goTo: (index: number) => dispatch({ type: "go", index }),
    close: () => dispatch({ type: "close" }),
    /** Opens the tour on a first visit only. Returns whether it opened. */
    autoOpen(): boolean {
      const store = storage();
      if (state.open || hasSeenTutorial(store)) return false;
      rememberTutorial(store, "started");
      dispatch({ type: "start", index: 0 });
      return true;
    },
  };
}

export type TutorialStore = ReturnType<typeof createTutorialStore>;

/** The app's one tour. */
export const tutorialStore: TutorialStore = createTutorialStore({ steps: TUTORIAL_STEPS, storage: browserTutorialStorage });
