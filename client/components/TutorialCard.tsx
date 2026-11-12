import type { KeyboardEvent, Ref } from "react";
import { tutorialKeyAction } from "../models/tutorial-navigation.ts";
import { TUTORIAL_LAYER_CLASS, type CardPosition, type Rect } from "../models/tutorial-placement.ts";
import type { TutorialStep } from "../models/tutorial-steps.ts";
import "../styles/tutorial.css";

export interface TutorialCardProps {
  step: TutorialStep;
  index: number;
  total: number;
  missing: boolean;
  ready?: boolean;
  position?: CardPosition;
  spotlight?: Rect | null;
  cardRef?: Ref<HTMLDivElement>;
  onBack(): void;
  onNext(): void;
  onClose(): void;
}

/**
 * The tour card: a manual popover in the browser's top layer, labelled by its title. It is not modal, so the
 * game stays playable underneath; the spotlight is a fixed, click-through child painted under the panel.
 */
export default function TutorialCard({ step, index, total, missing, ready = true, position, spotlight = null, cardRef, onBack, onNext, onClose }: TutorialCardProps) {
  const last = index >= total - 1;
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const action = tutorialKeyAction(event.key, event.target instanceof HTMLButtonElement);
    if (!action) return;
    event.preventDefault();
    if (action === "close") onClose();
    else if (action === "back") onBack();
    else onNext();
  }
  const style = position ? { top: position.top, left: position.left } : undefined;
  return <div ref={cardRef} className={`${TUTORIAL_LAYER_CLASS} tutorial-card${ready ? " is-ready" : ""}`} data-placement={position?.placement ?? "center"} data-step={step.id}
    popover="manual" role="dialog" aria-modal="false" aria-labelledby="tutorial-card-title" aria-describedby="tutorial-card-body" tabIndex={-1} style={style}
    onKeyDown={onKeyDown}>
    {spotlight
      ? <div className="tutorial-spotlight" aria-hidden="true" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }} />
      : <div className="tutorial-dim" aria-hidden="true" />}
    <div className="tutorial-card-panel">
      <button type="button" className="tutorial-card-dismiss" aria-label="Close tutorial" title="Close tutorial" onClick={onClose}><span aria-hidden="true">×</span></button>
      <p className="tutorial-card-count">Step {index + 1} of {total}</p>
      <h2 id="tutorial-card-title" className="tutorial-card-title">{step.title}</h2>
      <p id="tutorial-card-body" className="tutorial-card-body">{missing && step.missingBody ? step.missingBody : step.body}</p>
      <div className="tutorial-card-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      <div className="tutorial-card-actions">
        {!last && <button type="button" className="tutorial-card-close" onClick={onClose}>Close tutorial</button>}
        <div className="tutorial-card-nav">
          <button type="button" className="tutorial-card-back" disabled={index === 0} onClick={onBack}>Back</button>
          {last
            ? <button type="button" className="tutorial-card-primary" onClick={onClose}>Close tutorial</button>
            : <button type="button" className="tutorial-card-primary" onClick={onNext}>Next <span aria-hidden="true">→</span></button>}
        </div>
      </div>
    </div>
  </div>;
}
