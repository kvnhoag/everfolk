import { useEffect, useMemo, useRef, useState } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { createFreePlayBooster, type FreePlayBoosterSession } from "../models/freeplay-booster.ts";
import { playerPortraitState } from "../models/portrait-state.ts";
import { legacyLifeKey } from "../storage/legacy-store.ts";
import { readBoosterCollection, resolveBoosterPack } from "../storage/booster-collection.ts";
import type { BoosterCollectionPack, BoosterSceneOptions } from "../types/booster.ts";
import { freePlayCardView } from "./nft-card-view.ts";
import BoosterOpening from "../components/BoosterOpening.tsx";
import "./chain.css";
import "../styles/booster-opening.css";

export interface FreePlayBoosterModalProps {
  open: boolean; life: LifeState; world: WorldPack; onClose(): void;
}

/** Local collectibles from a finished free life: 1–5 cards, none before age 18. Only Weave Mode mints NFTs. */
export default function FreePlayBoosterModal({ open, life, world, onClose }: FreePlayBoosterModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState<FreePlayBoosterSession | null>(null);
  const [kept, setKept] = useState<BoosterCollectionPack | undefined>();
  const [legacyCount, setLegacyCount] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.showModal();
    let cancelled = false;
    setSession(null); setError(""); setKept(undefined);
    void createFreePlayBooster(life, world).then(result => {
      if (cancelled) return;
      const collection = readBoosterCollection(window.localStorage);
      setKept(collection.find(pack => pack.id === result.pack.evidence_hash));
      setLegacyCount(collection.reduce((sum, pack) => sum + pack.selected.length, 0));
      setSession(result);
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not prepare this life’s pack."); });
    return () => { cancelled = true; };
  }, [open, life, world]);

  const options = useMemo<BoosterSceneOptions | null>(() => {
    if (!session) return null;
    // Each card shows the v14 card a Weave mint would record, in this life's own sex (client/chain/nft-card-view.ts).
    // People of the city keep their ordinary-v3 NFT portrait, not the in-game Hi-Bit one.
    const ownPortrait = playerPortraitState(world, life, { portraitSet: "ordinary-v3" }).src;
    const cards = session.pack.cards.map(card => freePlayCardView(card, session.evidence.career_group, life, ownPortrait));
    const resolve = (selected: number[]) => {
      const collection = resolveBoosterPack(window.localStorage, {
        id: session.pack.evidence_hash, lifeKey: legacyLifeKey(life), characterName: life.character?.name ?? "A life in Alexandria", cards, selected,
      });
      window.dispatchEvent(new Event("everfolk:legacy-updated"));
      return collection.reduce((sum, pack) => sum + pack.selected.length, 0);
    };
    return { cards, legacyCount, reviewIndices: kept?.selected, onSave: resolve, onSkip: () => { resolve([]); onClose(); }, onClose };
  }, [session, life, world, legacyCount, kept, onClose]);

  if (!open) return null;
  return <dialog ref={dialogRef} className="chain-screen freeplay-booster-screen" aria-label="Your life’s booster pack" onCancel={event => { event.preventDefault(); onClose(); }}>
    {error ? <section className="freeplay-booster-message"><p role="alert">{error}</p><button onClick={onClose}>Back to memorial</button></section>
      : session && !session.pack.cards.length ? <section className="freeplay-booster-message"><h1>No pack this time</h1><p>Cards are earned, not drawn. This life did not contribute on a historical figure’s path. Earn a contributor title with a figure, or complete their defining work, to open a pack of those cards.</p><a href="#weave" onClick={onClose}>Play Weave Mode to get real NFTs →</a><button onClick={onClose}>Back to memorial</button></section>
      : kept && !kept.selected.length ? <section className="freeplay-booster-message"><h1>This pack was skipped</h1><p>No cards were added to your Legacy. Complete another life to discover a new pack.</p><button onClick={onClose}>Back to memorial</button></section>
      : options ? <BoosterOpening key={session!.pack.evidence_hash} options={options} />
      : <section className="freeplay-booster-message" role="status">Preparing your life’s legacy pack…<br /><button onClick={onClose}>Back to memorial</button></section>}
  </dialog>;
}
