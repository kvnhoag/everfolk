import { useEffect, useId, useRef } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import BirthStatRoll from "./BirthStatRoll.tsx";
import "./birth-roll-popover.css";

export interface BirthRollPopoverProps {
  open: boolean;
  life: LifeState;
  world: WorldPack;
  revealed: boolean;
  onReveal(): void;
  onContinue(): void;
  onClose(): void;
}

function OpenBirthRollPopover({ life, world, revealed, onReveal, onContinue, onClose }: Omit<BirthRollPopoverProps, "open">) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return <dialog ref={dialogRef} className="birth-roll-popover" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="birth-popover-heading">
      <div><h2 ref={headingRef} id={`${id}-title`} tabIndex={-1}>A new life</h2><p id={`${id}-description`}>{revealed ? "Starting stats ready" : "Rolling stats…"}</p></div>
      <button className="birth-popover-close" type="button" aria-label="Close starting stats" onClick={onClose}><span aria-hidden="true">×</span></button>
    </header>
    <div className="birth-popover-content"><BirthStatRoll life={life} world={world} revealed={revealed} onComplete={onReveal} autoStart /></div>
    <footer className="birth-popover-footer"><button className="birth-popover-continue" type="button" disabled={!revealed} onClick={() => { if (revealed) onContinue(); }}>Begin life <span aria-hidden="true">↗</span></button></footer>
  </dialog>;
}

/** Nothing rolls or renders on the page until the player opens this modal. */
export default function BirthRollPopover({ open, ...props }: BirthRollPopoverProps) {
  return open ? <OpenBirthRollPopover key={`${props.life.worldFingerprint}:${props.life.seed}`} {...props} /> : null;
}
