import { useEffect, useRef, useState } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { createFreePlayBooster, type FreePlayBoosterSession } from "../models/freeplay-booster.ts";
import MintPack from "./MintPack.tsx";
import "./chain.css";

export interface FreePlayBoosterModalProps {
  open: boolean;
  life: LifeState;
  world: WorldPack;
  onClose(): void;
}

export default function FreePlayBoosterModal({ open, life, world, onClose }: FreePlayBoosterModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState<FreePlayBoosterSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      if (dialogRef.current?.open) dialogRef.current.close();
      return;
    }
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    let cancelled = false;
    setLoading(true);
    setError("");

    void createFreePlayBooster(life, world)
      .then(result => {
        if (!cancelled) {
          setSession(result);
          setLoading(false);
        }
      })
      .catch(cause => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not prepare the booster pack.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, life, world]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="chain-screen freeplay-booster-screen"
      aria-label="Booster pack preview"
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="chain-shell">
        <header className="chain-topline">
          <span className="chain-preview">OFFLINE PREVIEW · NOT-WEAVE LIFE</span>
          <nav>
            <button className="chain-link" type="button" onClick={onClose}>
              Back to memorial ✕
            </button>
          </nav>
        </header>

        {loading && <p className="chain-loading" role="status">Rolling your life’s booster pack…</p>}
        {error && (
          <section className="chain-card">
            <h1>Could not load pack</h1>
            <p className="chain-error" role="alert">{error}</p>
            <div className="chain-actions">
              <button className="chain-secondary" type="button" onClick={onClose}>Close</button>
            </div>
          </section>
        )}

        {session && !loading && !error && (
          <MintPack
            practice
            walletPath={false}
            initialPack={session.pack}
            evidence={session.evidence}
            contract={session.contract}
            careerGroup={session.evidence.career_group}
            onChoose={slot => session.contract.chooseMintSlot(session.pack.life_id, slot)}
            onClose={onClose}
          />
        )}
      </div>
    </dialog>
  );
}
