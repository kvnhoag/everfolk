import type { KeyboardEvent, Ref } from "react";
import type { TutorialHint } from "../models/tutorial-hints.ts";
import { tutorialKeyAction, type TutorialMode } from "../models/tutorial-navigation.ts";
import { TUTORIAL_LAYER_CLASS, type CardPosition, type Rect } from "../models/tutorial-placement.ts";
import "../styles/tutorial.css";

export interface TutorialCardProps {
  hint: TutorialHint;
  index: number;
  total: number;
  mode: TutorialMode;
  missing: boolean;
  ready?: boolean;
  /** The opening flight is over; the card may now glide to a new section. */
  settled?: boolean;
  closing?: boolean;
  /** The section is drawn but out of view; offer to scroll to it. */
  offscreen?: boolean;
  position?: CardPosition;
  spotlight?: Rect | null;
  cardRef?: Ref<HTMLDivElement>;
  panelRef?: Ref<HTMLDivElement>;
  /** Automatic tip cards are on. Off: new sections glow instead. */
  tipsOn?: boolean;
  onTipsChange?(on: boolean): void;
  onBack(): void;
  onNext(): void;
  onClose(): void;
  onReveal?(): void;
}

function classes(mode: TutorialMode, ready: boolean, settled: boolean, closing: boolean): string {
  return [TUTORIAL_LAYER_CLASS, "tutorial-card", `is-${mode}`, ready && "is-ready", settled && "is-settled", closing && "is-closing"].filter(Boolean).join(" ");
}

/**
 * One tutorial hint: a manual popover in the browser's top layer, labelled by its title. It is not modal, so the game
 * stays playable underneath. "Got it" and × mark the hint seen; Back and Next tip appear only when hints are queued.
 */
export default function TutorialCard({ hint, index, total, mode, missing, ready = true, settled = false, closing = false, offscreen = false, position, spotlight = null, cardRef, panelRef, tipsOn = true, onTipsChange, onBack, onNext, onClose, onReveal }: TutorialCardProps) {
  const paged = total > 1;
  const last = index >= total - 1;
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const action = tutorialKeyAction(event.key, event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement, paged);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if (action === "close") onClose();
    else if (action === "back") onBack();
    else onNext();
  }
  const style = position ? { top: position.top, left: position.left } : undefined;
  return <div ref={cardRef} className={classes(mode, ready, settled, closing)} data-placement={position?.placement ?? "center"} data-hint={hint.id}
    popover="manual" role="dialog" aria-modal="false" aria-labelledby="tutorial-card-title" aria-describedby="tutorial-card-body" tabIndex={-1} style={style}
    onKeyDown={onKeyDown}>
    {spotlight
      ? <div className="tutorial-spotlight" aria-hidden="true" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }} />
      : mode === "manual" && <div className="tutorial-dim" aria-hidden="true" />}
    <div ref={panelRef} className="tutorial-card-panel">
      <button type="button" className="tutorial-card-dismiss" aria-label="Close tutorial" title="Close tutorial" onClick={onClose}><span aria-hidden="true">×</span></button>
      <p className="tutorial-card-count">{paged ? `Tip ${index + 1} of ${total}` : mode === "auto" ? "New tip" : "Tip"}</p>
      <h2 id="tutorial-card-title" className="tutorial-card-title">{hint.title}</h2>
      <p id="tutorial-card-body" className="tutorial-card-body">{missing && hint.missingBody ? hint.missingBody : hint.body}</p>
      {paged && <div className="tutorial-card-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>}
      <div className="tutorial-card-actions">
        {paged && <button type="button" className="tutorial-card-back" disabled={index === 0} onClick={onBack}>Back</button>}
        {offscreen && onReveal && <button type="button" className="tutorial-card-reveal" onClick={onReveal}>Show me</button>}
        <div className="tutorial-card-nav">
          {paged && !last && <button type="button" className="tutorial-card-next" onClick={onNext}>Next tip <span aria-hidden="true">→</span></button>}
          <button type="button" className="tutorial-card-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
      {onTipsChange && <label className="tutorial-card-toggle">
        <input type="checkbox" role="switch" checked={tipsOn} onChange={event => onTipsChange(event.target.checked)} />
        <span className="tutorial-card-toggle-copy">
          <span>Show a tip for each new section</span>
          <small aria-live="polite">{tipsOn ? "Turn off to have new sections glow for a few seconds instead." : "Off: new sections will glow for 10 seconds instead. The Tutorial and ? buttons still open tips."}</small>
        </span>
      </label>}
    </div>
  </div>;
}
