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
import { tipShownStore } from "../state/tip-shown.ts";
import { flashSections } from "../lib/section-flash.ts";
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
  // Every tip brings its section into view, so the one thing in focus is always on screen.
  const layout = useTutorialSpotlight(hint, hintKey, card, { waitForTarget: !manual, scroll: true });
  const settled = useTutorialFlight({ panel, ready: layout.ready, closing, run: state.run, onClosed: useCallback(() => {
    // Focus follows the card back to the Tutorial button, so keyboard players do not lose their place.
    if (card.current?.contains(document.activeElement)) findTutorialButton(card.current, false)?.focus({ preventScroll: true });
    onClosed();
  }, [onClosed]) });
  // The life clock waits only while the card is really on screen (not while an automatic tip waits for its section).
  useEffect(() => { tipShownStore.set(!closing && layout.ready); }, [closing, layout.ready]);
  useEffect(() => () => tipShownStore.set(false), []);
  // A manual popover sits in the top layer without making the page inert, so the game stays playable.
  useEffect(() => { if (card.current) showOnTop(card.current); }, [host]);
  // Only a tutorial the player opened takes focus, once it is visible; automatic tips never pull focus from the game.
  useEffect(() => { if (manual && !closing && layout.ready) card.current?.focus({ preventScroll: true }); }, [hintKey, layout.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const { index, total } = tutorialPosition(state);
  return <TutorialCard cardRef={card} panelRef={panel} hint={hint} index={index} total={total} mode={state.mode} missing={layout.missing}
    ready={layout.ready} settled={settled} closing={closing} offscreen={layout.offscreen} position={layout.card} spotlight={layout.spotlight}
    tipsOn={state.tipsOn} onTipsChange={tutorialStore.setTipsOn}
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
  // Tips off: a new section's border glows and fades instead of opening a card.
  const flashRun = state.flash?.run ?? 0;
  useEffect(() => {
    if (!state.flash) return;
    return flashSections(state.flash.ids.map(id => ({ selectors: tutorialHint(id)?.targets ?? [], label: `New here: ${tutorialHint(id)?.title ?? "a new section"}` })));
  }, [flashRun]); // eslint-disable-line react-hooks/exhaustive-deps
  if (typeof document === "undefined") return null;
  const visible = state.hintId !== null && (state.open || settledRun !== state.run) && !hidesTutorial(host);
  const announcement = state.open && state.mode === "auto" ? `New tip: ${tutorialHint(state.hintId)?.title ?? ""}` : "";
  return <>
    {createPortal(<p className="tutorial-announcer" aria-live="polite" role="status">{announcement}</p>, document.body)}
    {visible && createPortal(<ShownTutorial key={host ? "hosted" : "page"} state={state} host={host} closing={!state.open} onClosed={onClosed} />, host ?? document.body)}
  </>;
}
