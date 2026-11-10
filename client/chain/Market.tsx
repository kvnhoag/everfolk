import FigureArtwork from "./FigureArtwork.tsx";
import { useEffect, useId, useState } from "react";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import { filterMarket, marketRows, marketTabs, type MarketRow, type MarketTab } from "./token-page-model.ts";
import PixelIcon from "../PixelIcon.tsx";
import type { TokenView } from "./types.ts";
import "./token-market.css";
import "./ledger.css";

export interface MarketBodyProps {
  rows: readonly MarketRow[];
  busy?: boolean;
  error?: string;
  notice?: { text: string; href?: string };
  canConnect?: boolean;
  onConnect?(): void;
  onBuy(row: MarketRow): void;
}

const EMPTY_TEXT: Record<MarketTab, string> = {
  all: "Nothing is for sale right now.",
  figures: "No famous figures are for sale right now.",
  people: "No people of the city are for sale right now.",
};

/** Kept lives offered for sale, as a ledger in the life-record format. */
export function MarketBody({ rows, busy = false, error, notice, canConnect, onConnect, onBuy }: MarketBodyProps) {
  const headingId = useId();
  const [tab, setTab] = useState<MarketTab>("all");
  const shown = filterMarket(rows, tab);
  return <section className="ledger-panel market" aria-labelledby={headingId}>
    <header className="ledger-heading">
      <p className="ledger-kicker"><span className="cr-index">{String(rows.length).padStart(2, "0")}</span>Lives kept by other players</p>
      <h1 id={headingId} tabIndex={-1}>Market</h1>
      <p>Buy a kept life and choose what it does in the lives it meets. Every sale pays a share to the people who shaped it.</p>
    </header>
    {(canConnect || error || notice) && <div className="ledger-body">
      {canConnect && <div className="chain-actions"><button className="chain-secondary" type="button" disabled={busy} onClick={onConnect}>Connect a NEAR wallet to buy</button></div>}
      {error && <p className="chain-error" role="alert">{error}</p>}
      {notice && <p className="chain-notice" role="status">{notice.text} {notice.href && <a href={notice.href}>See its page</a>}</p>}
    </div>}
    <ul className="market-tabs" role="tablist" aria-label="Show">{marketTabs(rows).map(item => <li key={item.id}>
      <button className="market-tab" type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}<small>{item.count}</small></button>
    </li>)}</ul>
    {shown.length === 0
      ? <p className="market-empty">{EMPTY_TEXT[tab]}</p>
      : <ol className="ledger-rows market-ledger ledger-body">{shown.map(row => <li key={row.tokenId} className={`ledger-row market-row${row.isFigure ? " is-figure" : ""}`}>
          <span className="ledger-label">No. {row.tokenId}<small>{row.isFigure ? "Famous figure" : "Person of the city"}</small></span>
          <div className="ledger-value">
            <span className="market-thumb">{row.figureId
              ? <FigureArtwork figureId={row.figureId} />
              : <span className="ledger-emblem" aria-hidden="true"><PixelIcon name={row.emblem ?? "sun"} size={26} /></span>}</span>
            <h2><a href={row.href}>{row.title}</a></h2>
            <ul className="ledger-chips">
              {row.rarityLabel && <li className={`ledger-chip ${row.isFigure ? "is-gold" : "is-faience"}`}>{row.rarityLabel}</li>}
              {row.actionName && <li className="ledger-chip">{row.actionName}</li>}
              {row.affection !== undefined && <li className="ledger-chip is-faience">Affection {row.affection}</li>}
            </ul>
            <span className="ledger-detail">Offered by {row.seller}</span>
          </div>
          <div className="market-price">
            <span>{row.priceText}</span>
            {row.canBuy && <button className="chain-primary" type="button" disabled={busy} onClick={() => onBuy(row)}>Buy<span aria-hidden="true">→</span></button>}
          </div>
        </li>)}</ol>}
  </section>;
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
