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

/** A free life's pack: opens the 1–5 card pack preview (0 before age 18). Nothing is minted outside Weave Mode. */
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
    <dialog ref={dialogRef} className="chain-screen freeplay-booster-screen" aria-label="Fate cards preview"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="chain-shell">
        <header className="chain-topline">
          <span className="chain-preview">FREE LIFE · PREVIEW</span>
          <nav><button className="chain-link" type="button" onClick={onClose}>Back to your life ✕</button></nav>
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
          session.pack.cards.length === 0 ? (
            <section className="chain-card mint-pack">
              <div className="mint-pack-header">
                <p className="chain-kicker">Free Play preview · no NFT minted</p>
                <h1>No fate cards earned</h1>
                <p>
                  This life ended at age {session.evidence.death_age}, before adulthood (age 18), so no
                  booster cards are drawn. Reach adulthood and collect titles to draw 1–5 cards, or play
                  Weave Mode to mint real NFTs on NEAR.
                </p>
              </div>
              <div className="chain-actions">
                <a className="chain-primary" href="#weave" onClick={onClose}>
                  Play Weave Mode to get real NFTs <span aria-hidden="true">→</span>
                </a>
                <button className="chain-secondary" type="button" onClick={onClose}>
                  Close
                </button>
              </div>
            </section>
          ) : (
            <MintPack
              practice
              freePlay
              walletPath={false}
              initialPack={session.pack}
              evidence={session.evidence}
              contract={session.contract}
              careerGroup={session.evidence.career_group}
              onClose={onClose}
            />
          )
        )}
      </div>
    </dialog>
  );
}
