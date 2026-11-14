import type { ReactNode } from "react";
import type { SectionStepId } from "../models/section-steps.ts";
import PixelIcon from "./PixelIcon.tsx";
import { SectionStep } from "./YearChecklist.tsx";
import "../styles/locked.css";

/** A big X drawn corner to corner over something that is not open yet. */
function Cross() {
  return <svg className="locked-cross" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <line x1="2" y1="2" x2="98" y2="98" /><line x1="98" y1="2" x2="2" y2="98" />
  </svg>;
}

function Cover({ title, unlock, note }: { title: string; unlock: string; note?: string }) {
  return <div className="locked-cover">
    <Cross />
    <div className="locked-cover-copy">
      <span className="locked-cover-title"><PixelIcon name="lock" size={14} />{title}</span>
      <strong className="locked-cover-unlock">{unlock}</strong>
      {note && <p>{note}</p>}
    </div>
  </div>;
}

/**
 * Wraps a part of the screen that has not opened yet. Locked, its content is greyed out, cut short and
 * unclickable under a big X and the condition that opens it ("Unlocks at age 10", "After your first job").
 */
export function LockedArea({ locked, title, unlock, note, children }: { locked: boolean; title: string; unlock: string; note?: string; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return <div className="locked-area" role="group" aria-label={`${title}: locked. ${unlock}.`}>
    <div className="locked-area-content" inert aria-hidden="true">{children}</div>
    <Cover title={title} unlock={unlock} note={note} />
  </div>;
}

/** Stands in for a numbered section that has not opened yet: what it is and when it opens. */
export function LockedSection({ step, id, title, unlock, note }: { step: number; id: SectionStepId; title: string; unlock: string; note: string }) {
  return <section className="section-locked" data-step={id} aria-label={`${title}: locked. ${unlock}.`}>
    <span className="section-locked-step"><SectionStep step={step} /></span>
    <Cover title={title} unlock={unlock} note={note} />
  </section>;
}
