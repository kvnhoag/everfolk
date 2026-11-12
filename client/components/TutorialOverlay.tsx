import { useCallback, useEffect, useRef } from "react";
import { useTutorial } from "../hooks/useTutorial.ts";
import { useTopLayerDialog } from "../hooks/useTopLayerDialog.ts";
import { useTutorialSpotlight } from "../hooks/useTutorialSpotlight.ts";
import type { TutorialState } from "../models/tutorial-navigation.ts";
import { TUTORIAL_STEPS } from "../models/tutorial-steps.ts";
import { tutorialStore } from "../state/tutorial-store.ts";
import TutorialCard from "./TutorialCard.tsx";

function OpenTutorial({ state }: { state: TutorialState }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const step = TUTORIAL_STEPS[state.index];
  const stepKey = `${state.run}:${state.index}`;
  const layout = useTutorialSpotlight(step, stepKey, dialog);
  const focusCard = useCallback(() => { dialog.current?.focus({ preventScroll: true }); }, []);
  useTopLayerDialog(dialog, focusCard);
  // Each step moves focus to the card so its title and text are read out.
  useEffect(focusCard, [stepKey, focusCard]);
  return <TutorialCard dialogRef={dialog} step={step} index={state.index} total={TUTORIAL_STEPS.length} missing={layout.missing} ready={layout.ready}
    position={layout.card} spotlight={layout.spotlight} onBack={tutorialStore.back} onNext={tutorialStore.next} onClose={tutorialStore.close} />;
}

/** The guided tour, mounted once at the app root. Nothing is rendered while it is closed. */
export default function TutorialOverlay() {
  const state = useTutorial();
  return state.open ? <OpenTutorial state={state} /> : null;
}
