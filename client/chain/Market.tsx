import FigureArtwork from "./FigureArtwork.tsx";
import { useEffect, useId, useState, type ReactNode } from "react";
import SignInPanel from "./SignInPanel.tsx";
import { signInEntry } from "./sign-in-entry.ts";
import { chainHref } from "./chain-route.ts";
import { formatNear } from "./near-amount.ts";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import { filterMarket, marketRows, tokenTitle, marketTabs, type MarketRow, type MarketTab } from "./token-page-model.ts";
import { DEFAULT_FILTER, SORT_OPTIONS, applyFilter, effectiveFilter, filterOptions, type MarketFilter, type MarketSort } from "./market-filters.ts";
import type { CareerGroup } from "../../chain/ids.ts";
import PixelIcon from "../components/PixelIcon.tsx";
import { DEFAULT_MARKET_TERMS } from "./payout-preview.ts";
import type { Listing, MarketTerms, TokenView } from "./types.ts";
import SellYours, { type SellItem } from "./SellYours.tsx";
import "./token-market.css";
import "./ledger.css";

export interface MarketBodyProps {
  rows: readonly MarketRow[];
  busy?: boolean;
  error?: string;
  notice?: { text: string; href?: string };
  canConnect?: boolean;
  onConnect?(): void;
  /** Text of the sign-in button; defaults to the NEAR wallet wording. */
  connectLabel?: string;
  /** The open sign-in panel, shown under the button. */
  signInPanel?: ReactNode;
  onBuy(row: MarketRow): void;
  /** Starting filter; defaults to showing everything, cheapest first. */
  initialFilter?: MarketFilter;
  /** The signed-in player's own NFTs; the "Yours" tab appears only when this is set. */
  yours?: { items: readonly SellItem[]; terms: MarketTerms; error?: string; onList(tokenId: string, priceYocto: string): void; onUnlist(tokenId: string): void };
  /** Tab to open first. */
  initialTab?: MarketTab | typeof YOURS_TAB;
}

export const YOURS_TAB = "yours";
const WALLET_LABEL = "Connect a NEAR wallet to buy";
const SIGN_IN_LABELS = { signIn: "Sign in to buy", wallet: WALLET_LABEL };

const EMPTY_TEXT: Record<MarketTab, string> = {
  all: "Nothing is for sale right now.",
  figures: "No famous figures are for sale right now.",
  people: "No people of the city are for sale right now.",
};

/** Kept lives offered for sale, as a ledger in the life-record format. */
export function MarketBody({ rows, busy = false, error, notice, canConnect, onConnect, connectLabel = WALLET_LABEL, signInPanel, onBuy, initialFilter = DEFAULT_FILTER, yours, initialTab = "all" }: MarketBodyProps) {
  const headingId = useId();
  const [picked, setTab] = useState<MarketTab | typeof YOURS_TAB>(initialTab);
  const showYours = yours !== undefined && picked === YOURS_TAB;
  const tab: MarketTab = picked === YOURS_TAB ? "all" : picked;
  const [chosen, setFilter] = useState<MarketFilter>(initialFilter);
  const options = filterOptions(rows);
  const filter = effectiveFilter(chosen, options);
  const shown = filterMarket(applyFilter(rows, filter), tab);
  const filtered = filter.group !== "all" || filter.rarity !== "all";
  return <section className="ledger-panel market" aria-labelledby={headingId}>
    <header className="ledger-heading">
      <p className="ledger-kicker"><span className="cr-index">{String(rows.length).padStart(2, "0")}</span>Lives kept by other players</p>
      <h1 id={headingId} tabIndex={-1}>Market</h1>
      <p>Buy a kept life and choose what it does in the lives it meets. Every sale pays a share to the people who shaped it.</p>
    </header>
    {(canConnect || error || notice || signInPanel) && <div className="ledger-body">
      {canConnect && <div className="chain-actions"><button className="chain-secondary" type="button" disabled={busy} onClick={onConnect}>{connectLabel}</button></div>}
      {signInPanel}
      {error && <p className="chain-error" role="alert">{error}</p>}
      {notice && <p className="chain-notice" role="status">{notice.text} {notice.href && <a href={notice.href}>See its page</a>}</p>}
    </div>}
    {!showYours && <div className="market-filters">
      <label>Career<select value={filter.group} onChange={event => setFilter({ ...filter, group: event.target.value as CareerGroup | "all" })}>
        <option value="all">All careers</option>
        {options.groups.map(item => <option key={item.id} value={item.id}>{item.label} ({item.count})</option>)}
      </select></label>
      <label>Rarity<select value={String(filter.rarity)} onChange={event => setFilter({ ...filter, rarity: event.target.value === "all" ? "all" : Number(event.target.value) })}>
        <option value="all">All rarities</option>
        {options.rarities.map(item => <option key={item.id} value={item.id}>{item.label} ({item.count})</option>)}
      </select></label>
      <label>Sort<select value={filter.sort} onChange={event => setFilter({ ...filter, sort: event.target.value as MarketSort })}>
        {SORT_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
    </div>}
    <ul className="market-tabs" role="tablist" aria-label="Show">{marketTabs(rows).map(item => <li key={item.id}>
      <button className="market-tab" type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}<small>{item.count}</small></button>
    </li>)}{yours && <li>
      <button className="market-tab" type="button" role="tab" aria-selected={showYours} onClick={() => setTab(YOURS_TAB)}>Yours{!yours.error && <small>{yours.items.length}</small>}</button>
    </li>}</ul>
    {showYours && yours
      ? <div className="ledger-body">{yours.error && <p className="chain-error" role="alert">{yours.error}</p>}<SellYours items={yours.items} terms={yours.terms} busy={busy} onList={yours.onList} onUnlist={yours.onUnlist} /></div>
      : shown.length === 0
      ? <p className="market-empty">{filtered && rows.length > 0 ? "Nothing matches these filters." : EMPTY_TEXT[tab]}</p>
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

async function loadRows(backend: ChainBackend, listings: Listing[]): Promise<MarketRow[]> {
  const tokens = await Promise.all(listings.map(async listing => [listing.token_id, await backend.contract.token(listing.token_id).catch(() => null)] as const));
  return marketRows(listings, Object.fromEntries(tokens) as Record<string, TokenView | null>, backend.accountId);
}

export const YOURS_LOAD_ERROR = "Your NFTs could not be loaded.";

export interface LoadedMarket { rows: MarketRow[]; items: SellItem[] | null; itemsError?: string; terms: MarketTerms }

async function loadYours(backend: ChainBackend, accountId: string, listings: Listing[]): Promise<Pick<LoadedMarket, "items" | "itemsError" | "terms">> {
  const { contract } = backend;
  const terms = await contract.marketTerms().catch(() => DEFAULT_MARKET_TERMS);
  try {
    const mine = await contract.tokensOf(accountId);
    const items = mine.map(token => {
      const listed = listings.find(listing => listing.token_id === token.token_id);
      return {
        tokenId: token.token_id, title: tokenTitle(token.extra), href: chainHref({ kind: "token", tokenId: token.token_id }),
        listedPriceText: listed ? `${formatNear(listed.price)} NEAR` : null, hasSources: token.extra.sources.length > 0,
      };
    });
    return { items, terms };
  } catch {
    return { items: [], itemsError: YOURS_LOAD_ERROR, terms };
  }
}

/** Listings load first; the signed-in player's own NFTs load on their own so their failure never hides the market. */
export async function loadMarket(backend: ChainBackend): Promise<LoadedMarket> {
  const listings = await backend.contract.listings();
  const [rows, yours] = await Promise.all([
    loadRows(backend, listings),
    backend.accountId ? loadYours(backend, backend.accountId, listings) : Promise.resolve({ items: null, terms: DEFAULT_MARKET_TERMS }),
  ]);
  return { rows, ...yours };
}

export default function Market({ backend }: { backend: ChainBackend }) {
  const [loaded, setLoaded] = useState<LoadedMarket | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; href?: string } | undefined>();
  const [signingIn, setSigningIn] = useState(false);
  const { signin } = backend;

  useEffect(() => {
    let cancelled = false;
    void loadMarket(backend)
      .then(result => { if (!cancelled) setLoaded(result); })
      .catch(cause => { if (!cancelled) { setLoaded({ rows: [], items: null, terms: DEFAULT_MARKET_TERMS }); setError(errorText(cause, "The market could not be opened.")); } });
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

  const entry = signInEntry(signin, SIGN_IN_LABELS, {
    openPanel: () => setSigningIn(true),
    connectWallet: () => { void run(backend.connect, { text: "Wallet connected." }, "The wallet could not connect."); },
  });
  if (loaded === null) return <p className="chain-loading" role="status">Opening the market…</p>;
  return <MarketBody
    rows={loaded.rows} busy={busy} error={error} notice={notice} canConnect={!backend.accountId}
    connectLabel={entry.label} onConnect={entry.onConnect}
    signInPanel={signin && signingIn && !backend.accountId ? <SignInPanel available={signin.available} onEmail={signin.emailFlow} onWallet={signin.useWallet} onClose={() => setSigningIn(false)} /> : undefined}
    onBuy={row => { void run(() => backend.contract.buy(row.tokenId, row.priceYocto), { text: `${row.title} is yours.`, href: row.href }, "The purchase did not go through."); }}
    yours={loaded.items ? {
      items: loaded.items, terms: loaded.terms, error: loaded.itemsError,
      onList: (tokenId, price) => { void run(() => backend.contract.list(tokenId, price), { text: "It's on the market." }, "It could not be put up for sale."); },
      onUnlist: tokenId => { void run(() => backend.contract.unlist(tokenId), { text: "It's off the market." }, "It could not be taken off the market."); },
    } : undefined}
  />;
}
