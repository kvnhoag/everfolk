import { useEffect, useRef, useState } from "react";
import { readBoosterCollection } from "../storage/booster-collection.ts";
import type { BoosterCollectionPack } from "../types/booster.ts";
import BoosterOpening from "./BoosterOpening.tsx";

/** Saved local cards remain inspectable without redrawing a pack or signing a transaction. */
export default function BoosterCollection() {
  const [packs, setPacks] = useState<BoosterCollectionPack[]>([]);
  const [review, setReview] = useState<BoosterCollectionPack | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const refresh = () => {
      try { setPacks(readBoosterCollection(window.localStorage)); setError(""); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read your saved cards."); }
    };
    refresh();
    window.addEventListener("everfolk:legacy-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("everfolk:legacy-updated", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  useEffect(() => { if (review && !dialog.current?.open) dialog.current?.showModal(); }, [review]);
  const kept = packs.filter(pack => pack.selected.length);
  if (!kept.length && !error) return null;
  const count = packs.reduce((sum, pack) => sum + pack.selected.length, 0);
  return <section className="booster-collection" aria-label="Saved booster cards">
    <h2>Legacy cards <small>· {count}</small></h2>
    <p>Your Free to Play collection is saved on this device. Select a life to rotate and review its cards.</p>
    {error && <p role="status">{error}</p>}
    <div className="booster-collection-packs">{kept.map(pack => <button key={pack.id} onClick={() => setReview(pack)}>
      <img src={pack.cards[pack.selected[0]].art} alt="" />
      <span>{pack.characterName}<small>{pack.selected.length} {pack.selected.length === 1 ? "card" : "cards"} · Review collection →</small></span>
    </button>)}</div>
    {review && <dialog ref={dialog} className="booster-review-dialog" aria-label="Review saved Legacy cards" onCancel={event => { event.preventDefault(); setReview(null); }}>
      <BoosterOpening key={review.id} options={{ cards: review.cards, reviewIndices: review.selected, legacyCount: count, onSave: () => count, onSkip: () => setReview(null), onClose: () => setReview(null) }} />
    </dialog>}
  </section>;
}
