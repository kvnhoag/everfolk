import { useEffect, useId, useRef, useState } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import BirthStatRoll from "./BirthStatRoll.tsx";
import BirthAvatarPicker from "./BirthAvatarPicker.tsx";
import PixelIcon from "./PixelIcon.tsx";
import "../styles/birth-roll-popover.css";

export interface BirthRollPopoverProps {
  open: boolean;
  life: LifeState;
  world: WorldPack;
  revealed: boolean;
  onReveal(): void;
  onContinue(): void;
  onClose(): void;
  onReborn?(): void;
  onChooseAvatar?(variant: number): void;
}

function OpenBirthRollPopover({ life, world, revealed, onReveal, onContinue, onClose, onReborn, onChooseAvatar }: Omit<BirthRollPopoverProps, "open">) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  // Saved reveal history must not skip the animation for this popup opening.
  const [rollComplete, setRollComplete] = useState(false);
  function completeRoll() {
    setRollComplete(true);
    if (!revealed) onReveal();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return <dialog ref={dialogRef} className="birth-roll-popover" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="birth-popover-heading">
      <div><h2 ref={headingRef} id={`${id}-title`} tabIndex={-1}>A new life</h2><p id={`${id}-description`}>{rollComplete ? "Starting stats ready" : "Rolling stats…"}</p></div>
      <button className="birth-popover-close" type="button" aria-label="Close starting stats" onClick={onClose}><span aria-hidden="true">×</span></button>
    </header>
    <div className="birth-popover-content"><BirthStatRoll life={life} world={world} revealed={rollComplete} onComplete={completeRoll} autoStart />{rollComplete && onChooseAvatar && <BirthAvatarPicker life={life} world={world} onChoose={onChooseAvatar} />}</div>
    <footer className="birth-popover-footer">
      {onReborn && <button className="birth-popover-reborn" type="button" title="Roll a new name, background and starting stats" onClick={onReborn}><PixelIcon name="restart" size={16} />Reborn</button>}
      <button className="birth-popover-continue" type="button" disabled={!rollComplete} onClick={() => { if (rollComplete) onContinue(); }}>Begin life <span aria-hidden="true">↗</span></button>
    </footer>
  </dialog>;
}

/** Nothing rolls or renders on the page until the player opens this modal. */
export default function BirthRollPopover({ open, ...props }: BirthRollPopoverProps) {
  return open ? <OpenBirthRollPopover key={`${props.life.worldFingerprint}:${props.life.seed}`} {...props} /> : null;
}
