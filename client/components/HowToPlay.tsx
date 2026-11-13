import { useEffect, useId, useRef, useState } from "react";
import { useIdle } from "../hooks/useIdle.ts";
import type { PlayStep } from "../models/how-to-play.ts";
import type { RoadmapStage } from "../models/life-roadmap.ts";
import { LifePage, PlayPage, type RoadPortrait } from "./HowToPlayPages.tsx";
import "../styles/how-to-play.css";

/** How long the player may sit on a page before its main button starts to pulse. */
export const HOW_TO_PLAY_IDLE_MS = 5000;

/** Two pages: how to play a year, with the game's own screens; then a life, year by year and stage by stage. */
const PAGES = ["How to play", "Your life"] as const;

export interface HowToPlayProps {
  open: boolean;
  steps: readonly PlayStep[];
  stages: readonly RoadmapStage[];
  /** The player's own character, drawn at each stage on the Your life page. */
  portrait: RoadPortrait;
  tipsOn: boolean;
  onTipsChange(on: boolean): void;
  /** Opens whenever the game screen starts. */
  showAtStart: boolean;
  onShowAtStartChange(on: boolean): void;
  onClose(): void;
}

/**
 * The rule sheet shown whenever the game screen starts: page 1 the game's own screens with numbered steps, page 2 a
 * year in order and the road of a life, drawn with the player's own character. The clock waits while it is open. After a few idle seconds the main button pulses.
 */
export default function HowToPlay({ open, steps, stages, portrait, tipsOn, onTipsChange, showAtStart, onShowAtStartChange, onClose }: HowToPlayProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [page, setPage] = useState(0);
  const [active, setActive] = useState<string | null>(null);
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
    <div className="htp-body" role="tabpanel">
      {page === 0 ? <PlayPage steps={steps} active={active} onActive={setActive} /> : <LifePage stages={stages} portrait={portrait} />}
    </div>
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
        {!last && <button type="button" className="htp-back" onClick={onClose}>Start playing</button>}
        {last
          ? <button type="button" className={`htp-primary${idle ? " is-nudged" : ""}`} onClick={onClose}>Start playing <span aria-hidden="true">▶</span></button>
          : <button type="button" className={`htp-primary${idle ? " is-nudged" : ""}`} onClick={() => setPage(page + 1)}>Next: {PAGES[page + 1]} <span aria-hidden="true">→</span></button>}
      </div>
    </footer>
  </dialog>;
}
