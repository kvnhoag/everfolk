import { flashSections } from "../lib/section-flash.ts";
import { SECTION_TARGETS, type SectionStepId } from "../models/section-steps.ts";
import type { ChecklistItem } from "../models/year-checklist.ts";
import PixelIcon from "./PixelIcon.tsx";
import "../styles/onboarding.css";

function Mark({ state }: { state: ChecklistItem["state"] }) {
  if (state === "locked") return <PixelIcon name="lock" size={11} />;
  return <>{state === "todo" ? "!" : state === "done" ? "✓" : "·"}</>;
}

/** Scrolls a numbered section into view and lights it up for a few seconds. */
export function showSection(id: SectionStepId): void {
  const selectors = SECTION_TARGETS[id];
  const target = selectors.map(selector => document.querySelector(selector)).find(Boolean);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  flashSections([selectors], 4000);
}

/** The small numbered badge a section wears, matching its line in "This year" and the How to Play. */
export function SectionStep({ step }: { step: number }) {
  return <span className="section-step" aria-hidden="true">{step}</span>;
}

/**
 * "This year": the sections in the order to check them, each with what it needs now. A click scrolls to the
 * section and lights it up. Locked lines say when they open.
 */
export default function YearChecklist({ items }: { items: readonly ChecklistItem[] }) {
  return <nav className="year-checklist" aria-label="This year, in order">
    <span className="year-checklist-title">This year</span>
    <ol>
      {items.map(entry => <li key={entry.id}>
        <button type="button" className={`year-check is-${entry.state}`} onClick={() => showSection(entry.id)}
          aria-label={`${entry.step}. ${entry.title}: ${entry.status}`}>
          <span className="year-check-step" aria-hidden="true">{entry.step}</span>
          <span className="year-check-copy"><strong>{entry.title}</strong><small>{entry.status}</small></span>
          <span className="year-check-mark" aria-hidden="true"><Mark state={entry.state} /></span>
        </button>
      </li>)}
    </ol>
  </nav>;
}

/** Stands in for a section that has not opened yet: what it is and the age it opens. */
export function LockedSection({ step, id, title, opensAt, children }: { step: number; id: SectionStepId; title: string; opensAt: string; children: string }) {
  return <section className="section-locked" data-step={id} aria-label={`${title}, locked`}>
    <SectionStep step={step} />
    <div>
      <h2>{title} <span className="section-locked-badge"><PixelIcon name="lock" size={11} />{opensAt}</span></h2>
      <p>{children}</p>
    </div>
  </section>;
}
