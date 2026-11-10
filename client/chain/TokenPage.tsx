import FigureArtwork from "./FigureArtwork.tsx";
import { useEffect, useId, useState } from "react";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import { parseNearInput } from "./near-amount.ts";
import { tokenPageView, type TokenPageView } from "./token-page-model.ts";
import type { TokenView } from "./types.ts";
import "./token-market.css";

export interface TokenPageBodyProps {
  tokenId: string;
  view: TokenPageView;
  busy?: boolean;
  error?: string;
  notice?: string;
  canConnect?: boolean;
  onConnect?(): void;
  onSetAction(actionId: string): void;
  onWithdraw(): void;
  onList(priceYocto: string): void;
  onUnlist(): void;
  onBuy(): void;
}

function ActionPicker({ view, busy, onSetAction }: Pick<TokenPageBodyProps, "view" | "busy" | "onSetAction">) {
  const [choice, setChoice] = useState(view.currentAction.id);
  useEffect(() => setChoice(view.currentAction.id), [view.currentAction.id]);
  return <fieldset className="token-actions" disabled={busy}>
    <legend>Change what it does</legend>
    {view.menu.map(option => <label key={option.id} className={option.id === choice ? "is-selected" : ""}>
      <input type="radio" name="token-action" value={option.id} checked={option.id === choice} onChange={() => setChoice(option.id)} />
      <span><strong>{option.name}{option.selected ? " (now)" : ""}</strong><small>{option.description}</small></span>
    </label>)}
    <button className="chain-secondary" type="button" disabled={busy || choice === view.currentAction.id} onClick={() => onSetAction(choice)}>Make this its deed</button>
  </fieldset>;
}

function SaleBox({ view, busy, onList, onUnlist, onBuy }: Pick<TokenPageBodyProps, "view" | "busy" | "onList" | "onUnlist" | "onBuy">) {
  const priceId = useId();
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState("");
  function submit() {
    const parsed = parseNearInput(price);
    if (!parsed.ok) { setPriceError(parsed.error); return; }
    setPriceError("");
    onList(parsed.yocto);
  }
  if (view.listing) return <div className="token-sale">
    <p><strong>{view.listing.priceText}</strong> · offered by {view.listing.seller}</p>
    <div className="chain-actions">
      {view.canBuy && <button className="chain-primary" type="button" disabled={busy} onClick={onBuy}>Buy for {view.listing.priceText}<span aria-hidden="true">→</span></button>}
      {view.canUnlist && <button className="chain-secondary" type="button" disabled={busy} onClick={onUnlist}>Take it off the market</button>}
    </div>
  </div>;
  if (!view.canList) return <p className="chain-fine">Not for sale.</p>;
  return <form className="token-sale" onSubmit={event => { event.preventDefault(); submit(); }}>
    <label className="chain-field" htmlFor={priceId}>Price in NEAR<input id={priceId} inputMode="decimal" autoComplete="off" placeholder="2.5" value={price} disabled={busy} onChange={event => setPrice(event.target.value)} aria-invalid={priceError ? true : undefined} /></label>
    {priceError && <p className="chain-error" role="alert">{priceError}</p>}
    <p className="chain-fine">Each sale sends 5% to the people who shaped this life and 5% to the city.</p>
    <div className="chain-actions"><button className="chain-secondary" type="submit" disabled={busy}>Put it up for sale</button></div>
  </form>;
}

/** A kept life's page: who it is, what it does, the lives it touched, its earnings and its sale. */
export function TokenPageBody({ tokenId, view, busy = false, error, notice, canConnect, onConnect, onSetAction, onWithdraw, onList, onUnlist, onBuy }: TokenPageBodyProps) {
  const headingId = useId();
  return <div className="token-page">
    <section className={`chain-card token-hero${view.isFigure ? " is-figure" : ""}`} aria-labelledby={headingId}>
      <p className="chain-kicker">{view.kindLabel} · No. {tokenId}</p>
      <h1 id={headingId} tabIndex={-1}>{view.title}</h1>
      <FigureArtwork figureId={view.figureId} />
      <div className="token-tags"><span className={`chain-tag${view.isFigure ? " is-figure" : ""}`}>{view.rarityLabel}</span><span className="chain-tag">{view.lifeLine}</span></div>
      <p className="token-owner">{view.isOwner ? "This life is yours." : `Kept by ${view.owner}`}</p>
      <div className="token-affection"><span>{view.affectionText}</span><span className="life-report-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, view.affection))}%` }} /></span></div>
      {canConnect && <div className="chain-actions"><button className="chain-secondary" type="button" disabled={busy} onClick={onConnect}>Connect a NEAR wallet</button></div>}
      {error && <p className="chain-error" role="alert">{error}</p>}
      {notice && <p className="chain-notice" role="status">{notice}</p>}
    </section>
    <section className="chain-card" aria-label="Lives touched">
      <h2>Lives touched</h2>
      <p className="token-reach">{view.reach}</p>
      {view.children.length > 0
        ? <ul className="token-links">{view.children.map(child => <li key={child.tokenId}><a href={child.href}>Life No. {child.tokenId}</a></li>)}</ul>
        : <p className="chain-fine">No other life has met this one yet.</p>}
      {view.claimableText && <div className="token-claim">
        <p>You have <strong>{view.claimableText}</strong> to collect.</p>
        <button className="chain-primary" type="button" disabled={busy} onClick={onWithdraw}>Withdraw<span aria-hidden="true">→</span></button>
      </div>}
    </section>
    <section className="chain-card" aria-label="What it does">
      <h2>What it does</h2>
      <p><strong>{view.currentAction.name}.</strong> {view.currentAction.description}</p>
      {view.canChangeAction && <ActionPicker view={view} busy={busy} onSetAction={onSetAction} />}
    </section>
    <section className="chain-card" aria-label="For sale">
      <h2>For sale</h2>
      <SaleBox view={view} busy={busy} onList={onList} onUnlist={onUnlist} onBuy={onBuy} />
    </section>
    <section className="chain-card" aria-label="Who shaped this life">
      <h2>Who shaped this life</h2>
      {view.sources.length > 0
        ? <ul className="token-links">{view.sources.map(source => <li key={source.tokenId}><a href={source.href}>{source.name}</a><span>{source.percentText}</span></li>)}</ul>
        : <p className="chain-fine">No one else shaped this life.</p>}
      {view.evidenceHref && <p className="chain-fine"><a href={view.evidenceHref} target="_blank" rel="noreferrer">Read this life's record</a></p>}
    </section>
  </div>;
}

interface Loaded { token: TokenView; view: TokenPageView }

async function loadTokenPage(backend: ChainBackend, tokenId: string): Promise<Loaded | null> {
  const { contract, accountId } = backend;
  const token = await contract.token(tokenId);
  if (!token) return null;
  const [stats, children, listings, balance] = await Promise.all([
    contract.tokenStats(tokenId), contract.childrenOf(tokenId), contract.listings(), accountId ? contract.balanceOf(accountId) : Promise.resolve("0"),
  ]);
  const sources = await Promise.all(token.extra.sources.map(async source => [source.token_id, await contract.token(source.token_id).catch(() => null)] as const));
  const view = tokenPageView({
    tokenId, token, stats, viewer: accountId, balance, children,
    listing: listings.find(listing => listing.token_id === tokenId) ?? null, sourceTokens: Object.fromEntries(sources),
  });
  return { token, view };
}

export default function TokenPage({ backend, tokenId }: { backend: ChainBackend; tokenId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null | "missing">(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadTokenPage(backend, tokenId)
      .then(result => { if (!cancelled) setLoaded(result ?? "missing"); })
      .catch(cause => { if (!cancelled) { setLoaded("missing"); setError(errorText(cause, "This page could not be loaded.")); } });
    return () => { cancelled = true; };
  }, [backend, tokenId, reload]);

  async function run(action: () => Promise<unknown>, done: string, fallback: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); setNotice(done); setReload(value => value + 1); }
    catch (cause) { setError(errorText(cause, fallback)); }
    finally { setBusy(false); }
  }

  if (loaded === null) return <p className="chain-loading" role="status">Opening this life…</p>;
  if (loaded === "missing") return <section className="chain-card"><h1 tabIndex={-1}>No life here</h1><p>{error || `Nothing has been kept under No. ${tokenId}.`}</p><p><a href="#market">See the market</a></p></section>;
  const { contract } = backend;
  const listing = loaded.view.listing;
  return <TokenPageBody
    tokenId={tokenId} view={loaded.view} busy={busy} error={error} notice={notice}
    canConnect={!backend.accountId} onConnect={() => { void run(backend.connect, "Wallet connected.", "The wallet could not connect."); }}
    onSetAction={actionId => { void run(() => contract.setAction(tokenId, actionId), "Its deed has changed. New lives will feel it.", "The deed could not be changed."); }}
    onWithdraw={() => { void run(() => contract.withdraw(), "Sent to your wallet.", "The withdrawal did not go through."); }}
    onList={price => { void run(() => contract.list(tokenId, price), "It's on the market.", "It could not be put up for sale."); }}
    onUnlist={() => { void run(() => contract.unlist(tokenId), "It's off the market.", "It could not be taken off the market."); }}
    onBuy={() => { if (listing) void run(() => contract.buy(tokenId, listing.priceYocto), "It's yours.", "The purchase did not go through."); }}
  />;
}
