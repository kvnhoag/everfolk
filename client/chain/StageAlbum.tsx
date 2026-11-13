import { useEffect, useState } from "react";
import type { StageMintQuote, StageMintResult } from "../../chain/types.ts";
import type { LivesContract, SignedEvidence } from "./types.ts";
import { npcActionMenu } from "./life-report-model.ts";
import { errorText } from "./chain-backend.ts";
import { formatNear } from "./near-amount.ts";
import { rarityLabel } from "./chain-copy.ts";
import { editionLabel, nextEditionLabel } from "./edition-label.ts";
import "./mint-pack.css";

export function StageAlbumReceipt({ result, onClose }: { result: StageMintResult; onClose(): void }) {
  return <section className="chain-card"><h1>Your lived stages are kept</h1>
    <p>{result.tokens.length} stage figures minted for {formatNear(result.total_fee)} NEAR.</p>
    <div className="stage-album-grid">{result.tokens.map(token => <article className="stage-album-card" key={token.stage_id}>
      <span className="stage-album-art"><img className="stage-album-portrait" src={token.portrait_media} alt={token.character_name ?? "Stage portrait"} /></span>
      <a href={`#token/${token.token_id}`}>{token.character_name} · {token.stage_title}</a>
      <span>{rarityLabel(token.rarity)}{editionLabel(token) && ` · Edition ${editionLabel(token)}`}</span>
    </article>)}</div><button type="button" className="chain-secondary" onClick={onClose}>Back to My lives</button></section>;
}

/** All stages share one verified post-life payment. Legacy lives and already-paid packs keep their existing UI. */
export default function StageAlbum({ signed, contract, onMint, onClose, onDecline, practice = false, walletPath = true }: {
  signed: SignedEvidence; contract: LivesContract;
  onMint(action: string, fee: string, quoteHash?: string): Promise<StageMintResult>; onClose(): void; onDecline(): void;
  practice?: boolean; walletPath?: boolean;
}) {
  const menu = npcActionMenu(signed.evidence.career_group);
  const [action, setAction] = useState(menu[0]?.id ?? "");
  const [quote, setQuote] = useState<StageMintQuote | null>(null);
  const [result, setResult] = useState<StageMintResult | null>(null);
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(false);
  const [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const id = signed.evidence.life_id;
  useEffect(() => {
    let cancelled = false; setQuote(null); setError("");
    void contract.stageMintQuote(id, signed, action).then(value => { if (!cancelled) setQuote(value); })
      .catch(cause => { if (!cancelled) setError(errorText(cause, "Stage prices could not be loaded. Refresh to try again.")); });
    return () => { cancelled = true; };
  }, [contract, signed, action, id, attempt]);
  async function mint() {
    setBusy(true); setError("");
    try { setResult(await onMint(action, quote?.total_fee ?? "0", quote?.quote_hash)); }
    catch (cause) {
      const landed = await contract.stageMintResult(id).catch(() => null);
      if (landed) setResult(landed);
      else {
        const life = await contract.getLife(id).catch(() => null);
        setPending(life?.status === "minting");
        setError(errorText(cause, "The stage mint was not confirmed. Return here to finish it."));
        if (life?.status !== "minting") setQuote(null);
      }
    } finally { setBusy(false); }
  }
  if (result) return <StageAlbumReceipt result={result} onClose={onClose} />;
  return <section className="chain-card">
    <p className="chain-kicker">Life #{id} · {practice ? "Practice album" : "Verified stage album"}</p>
    <h1>Keep every stage you lived</h1>
    <p>Mint one portrait for each lived stage, including the stage in which this life ended. All portraits mint together after the life.</p>
    <label>Deed for your generic portraits <select value={action} disabled={busy || pending} onChange={event => setAction(event.target.value)}>
      {menu.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {quote && <><div className="stage-album-grid">{quote.cards.map(card => <article className="stage-album-card" key={card.stage_id}>
      <span className="stage-album-art"><img className="stage-album-portrait" src={card.portrait_media} alt={card.character_name} /></span>
      <div className="stage-album-body"><span className="chain-kicker">{card.stage_id} · Ages {card.stage_record.fromAge}–{card.stage_record.toAge}</span>
        <strong>{card.character_name} · {card.title}</strong><span>{card.figure_id ? "Historical figure" : "Stage portrait"} · {formatNear(card.fee)} NEAR</span>
        {card.rarity !== undefined && <span>{rarityLabel(card.rarity)}</span>}
        {nextEditionLabel(card) && <span>{nextEditionLabel(card)}</span>}
      </div></article>)}</div><p>Total: <strong>{formatNear(quote.total_fee)} NEAR</strong>. {quote.source_share_bps / 100}% goes to source tokens by impact; the remainder goes to the treasury.</p></>}
    <p className="chain-fine">Historical names use their shared supply caps. When a name is full, its stage keeps your own character’s portrait at the generic price. {practice ? "This is a local practice mint; no NEAR is spent." : walletPath ? "Confirm one payment in your wallet. Network gas is separate." : "Confirm one payment for the album."}</p>
    {error && <p role="alert" className="chain-error">{error}</p>}
    {pending && <p role="status">Your payment is saved. Finishing uses no second mint fee.</p>}
    <div className="chain-actions">
      <button className="chain-primary" type="button" disabled={busy || (!quote && !pending)} onClick={() => { void mint(); }}>{busy ? "Minting…" : pending ? "Finish paid album" : `Mint ${quote?.cards.length ?? "all"} stage figures`}</button>
      {!pending && !quote && <button type="button" disabled={busy} onClick={() => setAttempt(n => n + 1)}>Refresh prices</button>}
      <button className="chain-secondary" type="button" disabled={busy} onClick={onClose}>Keep for later</button>
      {!pending && <button className="chain-secondary" type="button" disabled={busy} onClick={onDecline}>Close this life</button>}
    </div>
  </section>;
}
