import FigureArtwork from "./FigureArtwork.tsx";
import { useEffect, useId, useState } from "react";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import { marketRows, type MarketRow } from "./token-page-model.ts";
import type { TokenView } from "./types.ts";
import "./token-market.css";

export interface MarketBodyProps {
  rows: readonly MarketRow[];
  busy?: boolean;
  error?: string;
  notice?: { text: string; href?: string };
  canConnect?: boolean;
  onConnect?(): void;
  onBuy(row: MarketRow): void;
}

/** Kept lives offered for sale by other players. */
export function MarketBody({ rows, busy = false, error, notice, canConnect, onConnect, onBuy }: MarketBodyProps) {
  const headingId = useId();
  return <div className="market">
    <section className="chain-card" aria-labelledby={headingId}>
      <p className="chain-kicker">Lives kept by other players</p>
      <h1 id={headingId} tabIndex={-1}>Market</h1>
      <p>Buy a kept life and choose what it does in the lives it meets. Every sale pays a share to the people who shaped it.</p>
      {canConnect && <div className="chain-actions"><button className="chain-secondary" type="button" disabled={busy} onClick={onConnect}>Connect a NEAR wallet to buy</button></div>}
      {error && <p className="chain-error" role="alert">{error}</p>}
      {notice && <p className="chain-notice" role="status">{notice.text} {notice.href && <a href={notice.href}>See its page</a>}</p>}
    </section>
    {rows.length === 0
      ? <p className="chain-empty">Nothing is for sale right now.</p>
      : <ul className="market-grid">{rows.map(row => <li key={row.tokenId} className={`chain-card market-item${row.isFigure ? " is-figure" : ""}`}>
          <p className="chain-kicker">No. {row.tokenId}</p>
          <h2><a href={row.href}>{row.title}</a></h2>
          <FigureArtwork figureId={row.figureId} />
          <div className="token-tags">{row.rarityLabel && <span className={`chain-tag${row.isFigure ? " is-figure" : ""}`}>{row.rarityLabel}</span>}{row.actionName && <span className="chain-tag">{row.actionName}</span>}</div>
          <p className="chain-fine">Offered by {row.seller}</p>
          <div className="market-buy">
            <strong>{row.priceText}</strong>
            {row.canBuy && <button className="chain-primary" type="button" disabled={busy} onClick={() => onBuy(row)}>Buy<span aria-hidden="true">→</span></button>}
          </div>
        </li>)}</ul>}
  </div>;
}

async function loadRows(backend: ChainBackend): Promise<MarketRow[]> {
  const listings = await backend.contract.listings();
  const tokens = await Promise.all(listings.map(async listing => [listing.token_id, await backend.contract.token(listing.token_id).catch(() => null)] as const));
  return marketRows(listings, Object.fromEntries(tokens) as Record<string, TokenView | null>, backend.accountId);
}

export default function Market({ backend }: { backend: ChainBackend }) {
  const [rows, setRows] = useState<MarketRow[] | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; href?: string } | undefined>();

  useEffect(() => {
    let cancelled = false;
    void loadRows(backend)
      .then(result => { if (!cancelled) setRows(result); })
      .catch(cause => { if (!cancelled) { setRows([]); setError(errorText(cause, "The market could not be opened.")); } });
    return () => { cancelled = true; };
  }, [backend, reload]);

  async function run(action: () => Promise<unknown>, done: { text: string; href?: string }, fallback: string) {
    setBusy(true);
    setError("");
    setNotice(undefined);
    try { await action(); setNotice(done); setReload(value => value + 1); }
    catch (cause) { setError(errorText(cause, fallback)); }
    finally { setBusy(false); }
  }

  if (rows === null) return <p className="chain-loading" role="status">Opening the market…</p>;
  return <MarketBody
    rows={rows} busy={busy} error={error} notice={notice} canConnect={!backend.accountId}
    onConnect={() => { void run(backend.connect, { text: "Wallet connected." }, "The wallet could not connect."); }}
    onBuy={row => { void run(() => backend.contract.buy(row.tokenId, row.priceYocto), { text: `${row.title} is yours.`, href: row.href }, "The purchase did not go through."); }}
  />;
}
