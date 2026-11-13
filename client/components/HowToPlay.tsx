import { useEffect, useId, useRef, useState } from "react";
import { useIdle } from "../hooks/useIdle.ts";
import { HOW_TO_PLAY_GOAL, YEAR_RHYTHM, type PlayChip, type PlayStep } from "../models/how-to-play.ts";
import { stageAges, type RoadmapStage } from "../models/life-roadmap.ts";
import PixelIcon from "./PixelIcon.tsx";
import "../styles/how-to-play.css";

/** How long the player may sit on a page before its main button starts to pulse. */
export const HOW_TO_PLAY_IDLE_MS = 5000;

function Chip({ chip }: { chip: PlayChip }) {
  return <span className={`htp-chip is-${chip.tone ?? "neutral"}`}><PixelIcon name={chip.icon} size={12} />{chip.text}</span>;
}

function StepCard({ step }: { step: PlayStep }) {
  return <li className="htp-step">
    <span className="htp-step-number" aria-hidden="true">{step.step}</span>
    <div className="htp-step-copy">
      <div className="htp-title-row"><h3>{step.title}</h3>{step.opens && <span className="htp-opens"><PixelIcon name="lock" size={10} />{step.opens}</span>}</div>
      <p>{step.body}</p>
    </div>
    <div className="htp-example" aria-label={`Example: ${step.doThis.text} gives ${step.getThat.map(chip => chip.text).join(", ")}`}>
      <Chip chip={step.doThis} />
      <span className="htp-arrow" aria-hidden="true">→</span>
      <span className="htp-results">{step.getThat.map(chip => <Chip key={chip.text} chip={chip} />)}</span>
    </div>
  </li>;
}

function BasicsPage({ steps }: { steps: readonly PlayStep[] }) {
  return <>
    <p className="htp-goal"><PixelIcon name="sun" size={14} />{HOW_TO_PLAY_GOAL}</p>
    <ol className="htp-steps">{steps.map(step => <StepCard key={step.id} step={step} />)}</ol>
    <p className="htp-rhythm">{YEAR_RHYTHM} <span>The numbers match the sections on screen and the “This year” checklist.</span></p>
  </>;
}

function RoadmapPage({ stages }: { stages: readonly RoadmapStage[] }) {
  return <>
    <p className="htp-goal"><PixelIcon name="pin" size={14} />Your life opens up as you grow. Each stage brings new things to do; locked parts of the screen say when they open.</p>
    <ol className="htp-roadmap">
      {stages.map((stage, index) => <li key={stage.id} className={`htp-stage is-${stage.state}`}>
        <span className="htp-stage-dot" aria-hidden="true">{index + 1}</span>
        <div className="htp-stage-body">
          <div className="htp-title-row"><h3>{stage.title}</h3><small className="htp-ages">{stageAges(stage)}</small>{stage.state === "current" && <span className="htp-here">You are here</span>}</div>
          <p className="htp-todo">{stage.todo}</p>
          {stage.unlocks.length > 0 && <ul className="htp-unlocks" aria-label={`Opens in ${stage.title}`}>
            {stage.unlocks.map(unlock => <li key={`${unlock.age}:${unlock.text}`}><PixelIcon name={unlock.icon} size={11} /><b>{unlock.age}</b>{unlock.text}</li>)}
          </ul>}
        </div>
      </li>)}
    </ol>
  </>;
}

const PAGES = ["How to play", "Your life, stage by stage"] as const;

export interface HowToPlayProps {
  open: boolean;
  steps: readonly PlayStep[];
  stages: readonly RoadmapStage[];
  tipsOn: boolean;
  onTipsChange(on: boolean): void;
  /** Opens whenever the game screen starts. */
  showAtStart: boolean;
  onShowAtStartChange(on: boolean): void;
  onClose(): void;
}

/**
 * The rule sheet shown whenever the game screen starts: page 1 the basics in numbered steps, page 2 the roadmap
 * of life stages. The clock waits while it is open. After a few idle seconds the main button pulses.
 */
export default function HowToPlay({ open, steps, stages, tipsOn, onTipsChange, showAtStart, onShowAtStartChange, onClose }: HowToPlayProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [page, setPage] = useState(0);
  const idle = useIdle(HOW_TO_PLAY_IDLE_MS, open, String(page));
  const last = page === PAGES.length - 1;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) { setPage(0); element.showModal(); }
    else if (!open && element.open) element.close();
  }, [open]);

  return <dialog ref={dialog} className="how-to-play" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="htp-header">
      <h2 id={titleId}>{PAGES[page]}</h2>
      <div className="htp-pages" role="tablist" aria-label="How to play pages">
        {PAGES.map((label, index) => <button key={label} type="button" role="tab" aria-selected={page === index} className={page === index ? "is-active" : ""} onClick={() => setPage(index)}>
          <span aria-hidden="true">{index + 1}</span>{label}
        </button>)}
      </div>
      <button type="button" className="htp-close" aria-label="Close How to play" onClick={onClose}>×</button>
    </header>
    <div className="htp-body" role="tabpanel">{page === 0 ? <BasicsPage steps={steps} /> : <RoadmapPage stages={stages} />}</div>
    <footer className="htp-footer">
      <div className="htp-switches">
        <label className="htp-tips">
          <input type="checkbox" role="switch" checked={tipsOn} onChange={event => onTipsChange(event.target.checked)} />
          <span>Show a tip whenever something new unlocks</span>
        </label>
        <label className="htp-tips">
          <input type="checkbox" role="switch" checked={showAtStart} onChange={event => onShowAtStartChange(event.target.checked)} />
          <span>Open How to play at every start</span>
        </label>
      </div>
      <div className="htp-nav">
        {page > 0 && <button type="button" className="htp-back" onClick={() => setPage(page - 1)}>Back</button>}
        {last
          ? <button type="button" className={`htp-primary${idle ? " is-nudged" : ""}`} onClick={onClose}>Start playing <span aria-hidden="true">▶</span></button>
          : <button type="button" className={`htp-primary${idle ? " is-nudged" : ""}`} onClick={() => setPage(page + 1)}>Next: {PAGES[page + 1]} <span aria-hidden="true">→</span></button>}
      </div>
    </footer>
  </dialog>;
}
