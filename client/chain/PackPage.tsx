import { useEffect, useState } from "react";
import type { MintPack as Pack } from "../../chain/types.ts";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import { rankedSaveKey } from "./ranked-session.ts";
import MintPack from "./MintPack.tsx";

/** A paid pack can be completed from chain alone, including on another device. */
export default function PackPage({ backend, lifeId }: { backend: ChainBackend; lifeId: string }) {
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setPack(null); setError("");
    void Promise.all([backend.contract.mintPack(lifeId), backend.contract.getLife(lifeId)]).then(([found, life]) => {
      if (cancelled) return;
      if (!found) setError("No open pack for this life. Check My lives for your minted NFT.");
      else if (life?.account_id !== backend.accountId) setError("Connect the wallet that owns this ranked life to open its pack.");
      else setPack(found);
    }).catch(cause => { if (!cancelled) setError(errorText(cause, "This pack could not be loaded. Reload to try again.")); });
    return () => { cancelled = true; };
  }, [backend.accountId, backend.contract, lifeId]);
  if (error) return <section className="chain-card"><h1 tabIndex={-1}>Your mint pack</h1><p className="chain-error" role="alert">{error}</p><a className="chain-secondary" href="#mine">My lives</a></section>;
  if (!pack) return <p role="status">Reading your pack from NEAR…</p>;
  return <MintPack practice={backend.mode === "preview"} key={lifeId} initialPack={pack} contract={backend.contract} txHash={backend.lastTransaction?.method === "choose_mint_slot" ? backend.lastTransaction.hash : null} onClose={() => { window.location.hash = "#mine"; }} onChoose={async slot => {
    const result = await backend.contract.chooseMintSlot(lifeId, slot);
    localStorage.removeItem(rankedSaveKey(lifeId));
    return result;
  }} />;
}
