import { useEffect, useMemo, useRef } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import LifeMomentsPack from "./LifeMomentsPack.tsx";
import { freeLifeMoments } from "../models/free-life-moments.ts";
import "./chain.css";

export interface FreePlayBoosterModalProps {
  open: boolean;
  life: LifeState;
  world: WorldPack;
  onClose(): void;
}

/** A free life's pack: the moments it lived, shown as what Weave Mode would have kept. Nothing is minted. */
export default function FreePlayBoosterModal({ open, life, world, onClose }: FreePlayBoosterModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const moments = useMemo(() => freeLifeMoments(life, world), [life, world]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open) { if (dialog?.open) dialog.close(); return; }
    if (dialog && !dialog.open) dialog.showModal();
  }, [open]);

  if (!open) return null;

  return (
    <dialog ref={dialogRef} className="chain-screen freeplay-booster-screen" aria-label="Moments of your life"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="chain-shell">
        <header className="chain-topline">
          <span className="chain-preview">FREE LIFE · PREVIEW</span>
          <nav><button className="chain-link" type="button" onClick={onClose}>Back to your life ✕</button></nav>
        </header>
        <LifeMomentsPack moments={moments} onClose={onClose} />
      </div>
    </dialog>
  );
}
