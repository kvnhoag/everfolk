import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTutorial } from "../hooks/useTutorial.ts";
import { useTutorialHost } from "../hooks/useTutorialHost.ts";
import { useTutorialSpotlight } from "../hooks/useTutorialSpotlight.ts";
import type { TutorialState } from "../models/tutorial-navigation.ts";
import { TUTORIAL_STEPS } from "../models/tutorial-steps.ts";
import { tutorialStore } from "../state/tutorial-store.ts";
import TutorialCard from "./TutorialCard.tsx";

function showOnTop(card: HTMLDivElement): void {
  try {
    if (card.matches(":popover-open")) card.hidePopover();
    card.showPopover();
  } catch (error) { console.warn("Everfolk tutorial: the tour card could not be shown above this screen.", error); }
}

function OpenTutorial({ state, host }: { state: TutorialState; host: HTMLDialogElement | null }) {
  const card = useRef<HTMLDivElement>(null);
  const step = TUTORIAL_STEPS[state.index];
  const stepKey = `${state.run}:${state.index}`;
  const layout = useTutorialSpotlight(step, stepKey, card);
  const focusCard = useCallback(() => { card.current?.focus({ preventScroll: true }); }, []);
  // A manual popover sits in the top layer without making the page inert, so the game stays playable.
  useEffect(() => { if (card.current) showOnTop(card.current); }, [host]);
  // Each new step moves focus to the card so its title and text are read out.
  useEffect(focusCard, [stepKey, focusCard]);
  return <TutorialCard cardRef={card} step={step} index={state.index} total={TUTORIAL_STEPS.length} missing={layout.missing} ready={layout.ready}
    position={layout.card} spotlight={layout.spotlight} onBack={tutorialStore.back} onNext={tutorialStore.next} onClose={tutorialStore.close} />;
}

/**
 * The guided tour, mounted once at the app root. Nothing is rendered while it is closed. While a modal window is
 * open (a game popup or a Weave screen) the card joins that window, because a modal window makes everything outside
 * it unclickable; otherwise it floats over the page.
 */
export default function TutorialOverlay() {
  const state = useTutorial();
  const host = useTutorialHost();
  if (!state.open || typeof document === "undefined") return null;
  return createPortal(<OpenTutorial key={host ? "hosted" : "page"} state={state} host={host} />, host ?? document.body);
}
