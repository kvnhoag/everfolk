import { useEffect, useId, useRef, useState } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { getHouseholdWelcome } from "../models/household-welcome.ts";
import type { HouseholdWelcomeModel } from "../models/household-welcome.ts";
import { formatMoney } from "../models/wealth.ts";
import PixelIcon from "./PixelIcon.tsx";
import "../styles/household-welcome.css";

export interface HouseholdWelcomeProps {
  open: boolean;
  life: LifeState;
  world: WorldPack;
  onClose(): void;
  onOpenCouncil(): void;
}

function OpenHouseholdWelcome({ introduction, world, onClose, onOpenCouncil }: {
  introduction: HouseholdWelcomeModel; world: WorldPack; onClose(): void; onOpenCouncil(): void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const [page, setPage] = useState(0);
  const step = page > 0 ? introduction.steps[page - 1] : undefined;
  const lastPage = page === introduction.steps.length;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
  }, [page]);

  return <dialog ref={dialogRef} className="household-welcome-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="household-welcome-header">
      <span>{introduction.kind === "royal" ? "A ROYAL LIFE" : "AN ARISTOCRATIC LIFE"}</span>
      <button type="button" className="household-welcome-close" aria-label="Close household introduction" onClick={onClose}><PixelIcon name="close" size={16} /></button>
    </header>
    <div className="household-welcome-content">
      <div className="household-welcome-symbol" aria-hidden="true"><PixelIcon name={step?.icon ?? "home"} size={30} /></div>
      {step && <p className="household-welcome-step" aria-live="polite">Step {page} of {introduction.steps.length} · {introduction.councilTitle}</p>}
      <h2 ref={headingRef} id={`${id}-title`} tabIndex={-1}>{step?.title ?? introduction.title}</h2>
      <p id={`${id}-description`}>{step?.description ?? introduction.congratulations}</p>
      {!step ? <>
        <div className="household-welcome-house"><span>{introduction.councilTitle}</span><strong>{introduction.concerns}</strong></div>
        <p className="household-welcome-detail">{introduction.childhoodNote}</p>
        <p className="household-welcome-invitation">Take a short tour of the functions that shape your household.</p>
      </> : <>
        {step.id === "treasury" && <div className="household-welcome-house household-welcome-treasury"><span>{introduction.treasuryLabel}</span><strong>{formatMoney(introduction.treasury, world)}</strong></div>}
        {step.id === "conditions" && <ul className="household-welcome-metrics" aria-label="Your household's current conditions">{introduction.metrics.map(metric => <li key={metric.id}><span>{metric.label}</span><strong>{Number(metric.value.toFixed(1))}</strong></li>)}</ul>}
        {step.id === "titles" && introduction.titleNames.length > 0 && <ul className="household-welcome-titles" aria-label="Household title paths">{introduction.titleNames.map(title => <li key={title}><PixelIcon name="feather" size={15} /><span>{title}</span></li>)}</ul>}
        <p className="household-welcome-detail">{step.detail}</p>
      </>}
    </div>
    <footer className="household-welcome-footer">
      <div className="household-welcome-secondary">
        {page > 0 && <button type="button" className="household-welcome-back" onClick={() => setPage(current => current - 1)}>Back</button>}
        <button type="button" className="household-welcome-skip" onClick={onClose}>{lastPage ? "Finish tour" : "Skip tour"}</button>
      </div>
      <button type="button" className="household-welcome-next" onClick={() => { if (lastPage) onOpenCouncil(); else setPage(current => current + 1); }}>
        {lastPage ? `Explore ${introduction.councilTitle}` : page === 0 ? "Show me around" : "Next"}<PixelIcon name="arrow" size={15} />
      </button>
    </footer>
  </dialog>;
}

/** Presentation only: the parent decides when the per-life introduction appears. */
export default function HouseholdWelcome({ open, life, world, onClose, onOpenCouncil }: HouseholdWelcomeProps) {
  if (!open) return null;
  const introduction = getHouseholdWelcome(world, life);
  if (!introduction) return null;
  return <OpenHouseholdWelcome key={`${life.worldFingerprint}:${life.seed}`} introduction={introduction} world={world} onClose={onClose} onOpenCouncil={onOpenCouncil} />;
}
