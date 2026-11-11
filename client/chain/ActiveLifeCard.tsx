import { useEffect, useState } from "react";
import type { LifeView } from "../../chain/types.ts";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import { rankedProgress, type RankedProgress } from "./ranked-progress.ts";

export function useActiveRankedLife(backend: ChainBackend) {
  const [active, setActive] = useState<{ life: LifeView; progress: RankedProgress } | null>(null);
  const [loading, setLoading] = useState(Boolean(backend.accountId));
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setActive(null); setError(""); setLoading(Boolean(backend.accountId));
    if (!backend.accountId) return;
    void backend.contract.activeLifeOf(backend.accountId).then(async life => {
      const [progress, pack] = life ? await Promise.all([rankedProgress(life), backend.contract.mintPack(life.life_id).catch(() => null)]) : [null, null];
      if (progress && pack) { progress.status = "ended"; progress.pack = true; }
      if (!cancelled) { setActive(life && progress ? { life, progress } : null); setLoading(false); }
    }).catch(cause => { if (!cancelled) { setError(errorText(cause, "Your ranked life could not be loaded. Reload to try again.")); setLoading(false); } });
    return () => { cancelled = true; };
  }, [backend.accountId, backend.contract, backend.revision]);
  return { active, loading, error };
}

export default function ActiveLifeCard({ life, progress, busy, walletPath = true, needsPlayKey = false, onOpen, onGiveUp }: {
  life: LifeView; progress: RankedProgress; busy?: boolean; walletPath?: boolean; needsPlayKey?: boolean; onOpen(): void; onGiveUp?(): void;
}) {
  const ended = progress.status === "ended";
  const missing = progress.status === "unavailable";
  return <section className={`chain-card active-life-card${ended ? " is-ended" : ""}`} aria-label="Your Weave life">
    <p className="chain-kicker">Weave life #{life.life_id} · {ended ? progress.pack ? "Ended · Pack ready" : "Ended · Ready to mint" : missing ? "Save needed on this device" : "In progress"}</p>
    <h2>{ended ? progress.pack ? "Your pack is waiting" : "Your story is complete" : progress.name ?? "A life in Alexandria"}</h2>
    <p>{progress.pack ? "Your paid pack is saved on NEAR. Open it to review your three cards, use any remaining rerolls, and choose one to mint. You can finish it from any device with this account." : ended ? `Your life ended${progress.age !== undefined ? ` at age ${progress.age}` : ""}. It is saved in this browser and ready to mint. You haven't minted an NFT yet.` : missing ? "Open this life in the browser where you played it. The on-chain record alone cannot restore your choices." : `Your progress is saved${progress.age !== undefined ? ` · Age ${progress.age}` : ""}. Return to the same life and keep your choices.`}</p>
    <div className="chain-actions">
      {!missing && <button className="chain-primary" type="button" disabled={busy} onClick={onOpen}>{needsPlayKey ? "Sign in again for popup-free play" : ended ? progress.pack ? "Open mint pack" : "Review & mint this life" : progress.status === "new" ? "Begin this life" : "Continue this life"}<span aria-hidden="true">→</span></button>}
      {onGiveUp && <button className="chain-secondary" type="button" disabled={busy} onClick={onGiveUp}>{ended ? "Close without minting" : "Give up this life"}</button>}
    </div>
    {ended && !progress.pack && <p className="chain-fine">Minting is optional. Keep this browser's save until you mint; the finished save is needed for verification.</p>}
  </section>;
}
