import { isTutorialHintId, type TutorialHintId } from "../models/tutorial-hints.ts";
import { INITIAL_TUTORIAL, tutorialReducer, type TutorialAction, type TutorialState } from "../models/tutorial-navigation.ts";
import { NO_TUTORIAL_CONTEXT, type TutorialContext, type TutorialView } from "../models/tutorial-triggers.ts";
import { browserTutorialStorage, readTutorialProgress, writeTutorialProgress, type TutorialStorage } from "../storage/tutorial-storage.ts";

export interface TutorialStoreOptions {
  storage(): TutorialStorage | undefined;
}

/**
 * The tutorial controller: an external store for useSyncExternalStore. Screens report what is on screen;
 * the store opens the hint for each new stage. It never navigates and never pauses the game.
 */
export function createTutorialStore({ storage }: TutorialStoreOptions) {
  let state: TutorialState = INITIAL_TUTORIAL;
  let loaded = false;
  let game: TutorialContext = NO_TUTORIAL_CONTEXT;
  let chain: TutorialView | null = null;
  let context: TutorialContext = NO_TUTORIAL_CONTEXT;
  let contextKey = JSON.stringify(context);
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const listener of [...listeners]) listener();
  }

  /** Saved progress is read on first use, so server rendering never touches storage. */
  function load(): void {
    if (loaded) return;
    loaded = true;
    const saved = readTutorialProgress(storage());
    const seen = saved.seen.filter(isTutorialHintId);
    const hintId = isTutorialHintId(saved.current) ? saved.current : null;
    if (seen.length || hintId || saved.tipsOff) state = { ...state, seen, hintId, tipsOn: !saved.tipsOff };
  }

  function dispatch(action: TutorialAction): void {
    load();
    const next = tutorialReducer(state, action, context);
    if (next === state) return;
    const persist = next.seen !== state.seen || next.hintId !== state.hintId || next.tipsOn !== state.tipsOn;
    state = next;
    if (persist) writeTutorialProgress(storage(), { seen: state.seen, current: state.hintId, tipsOff: !state.tipsOn });
    emit();
  }

  function updateContext(): void {
    const next = chain ? { view: chain, characterSection: null, life: game.life } : game;
    const key = JSON.stringify(next);
    if (key === contextKey) return;
    context = next;
    contextKey = key;
    dispatch({ type: "sync" });
  }

  return {
    /** Reads saved progress on first use, so the switch shows the remembered On/Off before any screen reports in. */
    getSnapshot: (): TutorialState => { load(); return state; },
    getServerSnapshot: (): TutorialState => INITIAL_TUTORIAL,
    getContext: (): TutorialContext => context,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /** What the game shows; null when no game is mounted. */
    setGameContext(next: TutorialContext | null): void {
      game = next ?? NO_TUTORIAL_CONTEXT;
      updateContext();
    },
    /** The Weave screen over the game, or null when none is open. */
    setChainView(next: TutorialView | null): void {
      chain = next;
      updateContext();
    },
    /** The Tutorial button: the current step if it is on screen, else this screen's most relevant hint. */
    openFromButton: () => dispatch({ type: "open" }),
    /** A section's "?" button: that section's hint, even when already seen. */
    openHint: (hintId: TutorialHintId) => dispatch({ type: "open", hintId }),
    next: () => dispatch({ type: "next" }),
    back: () => dispatch({ type: "back" }),
    close: () => dispatch({ type: "close" }),
    /** Turns automatic tip cards on or off. Off: new sections glow instead. The Tutorial and "?" buttons always open cards. */
    setTipsOn: (on: boolean) => dispatch({ type: "tips", on }),
  };
}

export type TutorialStore = ReturnType<typeof createTutorialStore>;

/** The app's one tutorial. */
export const tutorialStore: TutorialStore = createTutorialStore({ storage: browserTutorialStorage });
