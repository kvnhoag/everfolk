import { useEffect, useId, useState } from "react";
import type { LifeView } from "../../chain/types.ts";
import ActiveLifeCard, { useActiveRankedLife } from "./ActiveLifeCard.tsx";
import PixelIcon from "../PixelIcon.tsx";
import FigureArtwork from "./FigureArtwork.tsx";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import { keptRows, type KeptRow } from "./token-page-model.ts";
import "./ledger.css";

/** The signed-in player's kept lives, in the life-record ledger format. */
export default function MyLives({ backend, onOpen }: { backend: ChainBackend; onOpen?(life: LifeView): Promise<void> }) {
  const headingId = useId();
  const current = useActiveRankedLife(backend);
  const [busy, setBusy] = useState(false);
  async function openLife(life: LifeView) {
    if (!onOpen) { window.location.hash = "#ranked"; return; }
    setBusy(true); setError("");
    try { await onOpen(life); } catch (cause) { setError(errorText(cause, "This life could not be opened.")); } finally { setBusy(false); }
  }
  const [rows, setRows] = useState<KeptRow[] | null>(null);
  const [error, setError] = useState("");
  const { accountId, revision } = backend;

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError("");
    if (!accountId) return;
    void backend.contract.tokensOf(accountId).then(tokens => { if (!cancelled) setRows(keptRows(tokens)); }, cause => { if (!cancelled) setError(errorText(cause, "Your lives could not be read from NEAR.")); });
    return () => { cancelled = true; };
  }, [accountId, revision]); // eslint-disable-line react-hooks/exhaustive-deps

  return <section className="ledger-panel market" aria-labelledby={headingId}>
    <header className="ledger-heading">
      <p className="ledger-kicker"><span className="cr-index">{String(rows?.length ?? 0).padStart(2, "0")}</span>Kept on NEAR</p>
      <h1 id={headingId} tabIndex={-1}>My lives</h1>
      <p>Your current ranked life, completed lives waiting to mint, and the NFTs your wallet owns.</p>
    </header>
    {!accountId && <p className="market-empty">Connect a NEAR wallet to see the lives you keep.</p>}
    {current.active && <ActiveLifeCard life={current.active.life} progress={current.active.progress} busy={busy} onOpen={() => { void openLife(current.active!.life); }} />}
    {current.loading && <p role="status" className="market-empty">Finding your ranked life…</p>}
    {current.error && <p className="chain-error" role="alert">{current.error}</p>}
    {error && <div className="ledger-body"><p className="chain-error" role="alert">{error}</p></div>}
    {accountId && rows === null && !error && <p className="market-empty" role="status">Reading your lives from NEAR…</p>}
    {rows !== null && rows.length === 0 && <p className="market-empty">No minted NFTs yet. {current.active ? "Your ranked life is shown above." : <a href="#ranked">Start a ranked life</a>}</p>}
    {rows !== null && rows.length > 0 && <ol className="ledger-rows market-ledger ledger-body">{rows.map(row => <li key={row.tokenId} className="ledger-row">
      <span className="ledger-label">No. {row.tokenId}<small>{row.isFigure ? "Famous figure" : "Person of the city"}</small></span>
      <div className="ledger-value">
        <span className="market-thumb">{row.figureId ? <FigureArtwork figureId={row.figureId} /> : <span className="ledger-emblem" aria-hidden="true"><PixelIcon name={row.emblem ?? "sun"} size={26} /></span>}</span>
        <h2><a href={row.href}>{row.title}</a></h2>
        <ul className="ledger-chips">
          <li className={`ledger-chip ${row.isFigure ? "is-gold" : "is-faience"}`}>{row.rarityLabel}</li>
          <li className="ledger-chip">{row.actionName}</li>
          <li className="ledger-chip is-faience">Affection {row.affection}</li>
        </ul>
      </div>
      <div className="market-price"><a className="chain-secondary" href={row.href}>Open<span aria-hidden="true">→</span></a></div>
    </li>)}</ol>}
  </section>;
}
