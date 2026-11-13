import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTutorial } from "../hooks/useTutorial.ts";
import { findTutorialButton, useTutorialFlight } from "../hooks/useTutorialFlight.ts";
import { useTutorialHost } from "../hooks/useTutorialHost.ts";
import { hidesTutorial } from "../models/tutorial-host.ts";
import { useTutorialSpotlight } from "../hooks/useTutorialSpotlight.ts";
import { tutorialHint } from "../models/tutorial-hints.ts";
import { tutorialPosition, type TutorialState } from "../models/tutorial-navigation.ts";
import { tutorialStore } from "../state/tutorial-store.ts";
import TutorialCard from "./TutorialCard.tsx";

function showOnTop(card: HTMLDivElement): void {
  try {
    if (card.matches(":popover-open")) card.hidePopover();
    card.showPopover();
  } catch (error) { console.warn("Everfolk tutorial: the tip could not be shown above this screen.", error); }
}

interface ShownProps {
  state: TutorialState;
  host: HTMLDialogElement | null;
  closing: boolean;
  onClosed(): void;
}

function ShownTutorial({ state, host, closing, onClosed }: ShownProps) {
  const card = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hint = tutorialHint(state.hintId) ?? tutorialHint("about")!;
  const hintKey = `${state.run}:${hint.id}`;
  const manual = state.mode === "manual";
  const layout = useTutorialSpotlight(hint, hintKey, card, { waitForTarget: !manual, scroll: manual });
  const settled = useTutorialFlight({ panel, ready: layout.ready, closing, run: state.run, onClosed: useCallback(() => {
    // Focus follows the card back to the Tutorial button, so keyboard players do not lose their place.
    if (card.current?.contains(document.activeElement)) findTutorialButton(card.current, false)?.focus({ preventScroll: true });
    onClosed();
  }, [onClosed]) });
  // A manual popover sits in the top layer without making the page inert, so the game stays playable.
  useEffect(() => { if (card.current) showOnTop(card.current); }, [host]);
  // Only a tutorial the player opened takes focus, once it is visible; automatic tips never pull focus from the game.
  useEffect(() => { if (manual && !closing && layout.ready) card.current?.focus({ preventScroll: true }); }, [hintKey, layout.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const { index, total } = tutorialPosition(state);
  return <TutorialCard cardRef={card} panelRef={panel} hint={hint} index={index} total={total} mode={state.mode} missing={layout.missing}
    ready={layout.ready} settled={settled} closing={closing} offscreen={layout.offscreen} position={layout.card} spotlight={layout.spotlight}
    onBack={tutorialStore.back} onNext={tutorialStore.next} onClose={tutorialStore.close} onReveal={layout.reveal} />;
}

/**
 * The tutorial, mounted once at the app root. While a modal window is open (a game popup or a Weave screen) the card
 * joins that window, because a modal window makes everything outside it unclickable; otherwise it floats over the page.
 * A closed card stays mounted for its flight back to the Tutorial button.
 */
export default function TutorialOverlay() {
  const state = useTutorial();
  const host = useTutorialHost();
  const [settledRun, setSettledRun] = useState(0);
  const onClosed = useCallback(() => setSettledRun(state.run), [state.run]);
  if (typeof document === "undefined") return null;
  const visible = state.hintId !== null && (state.open || settledRun !== state.run) && !hidesTutorial(host);
  const announcement = state.open && state.mode === "auto" ? `New tip: ${tutorialHint(state.hintId)?.title ?? ""}` : "";
  return <>
    {createPortal(<p className="tutorial-announcer" aria-live="polite" role="status">{announcement}</p>, document.body)}
    {visible && createPortal(<ShownTutorial key={host ? "hosted" : "page"} state={state} host={host} closing={!state.open} onClosed={onClosed} />, host ?? document.body)}
  </>;
}
