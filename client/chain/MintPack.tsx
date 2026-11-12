import { useEffect, useState } from "react";
import type { MintPack as Pack, MintResult, Evidence } from "../../chain/types.ts";
import type { CareerGroup } from "../../chain/ids.ts";
import { actionName, actionDescription, figureTitle, GROUP_TITLE, groupOfAction, rarityLabel } from "./chain-copy.ts";
import { errorText } from "./chain-backend.ts";
import { formatNear } from "./near-amount.ts";
import FigureArtwork from "./FigureArtwork.tsx";
import PixelPortrait from "../components/PixelPortrait.tsx";
import MintReveal from "./MintReveal.tsx";
import { mintRevealView } from "./life-report-model.ts";
import type { LivesContract } from "./types.ts";
import "./mint-pack.css";

export interface MintPackProps {
  initialPack: Pack;
  evidence?: Evidence;
  practice?: boolean;
  walletPath?: boolean;
  contract: LivesContract;
  careerGroup?: CareerGroup;
  onChoose?(slot: number): Promise<MintResult>;
  onClose(): void;
  txHash?: string | null;
}

/** All outcomes and rerolls are contract values. Animation only reveals confirmed cards. */
export default function MintPack({ initialPack, evidence, walletPath = true, practice = false, contract, careerGroup, onChoose, onClose, txHash }: MintPackProps) {
  const [pack, setPack] = useState(initialPack);
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(() => { setOpened(true); setOpening(false); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650);
    return () => clearTimeout(timer);
  }, [opening]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);
  const group = careerGroup ?? groupOfAction(pack.cards.find(c => c.kind === "npc")?.action_id ?? null) ?? "letters";

  async function reroll(slot: number) {
    setBusy(`reroll:${slot}`); setError("");
    try { setPack(await contract.rerollMintSlot(pack.life_id, slot, pack.reroll_fee)); setSelected(null); }
    catch (cause) {
      // Re-read once: a wallet can report a timeout after the paid reroll has already landed.
      const landed = await contract.mintPack(pack.life_id).catch(() => null);
      if (landed?.cards[slot].rerolled) { setPack(landed); setSelected(null); }
      else setError(errorText(cause, "The reroll was not confirmed. Your existing card is safe; try again."));
    } finally { setBusy(null); }
  }
  async function choose() {
    if (selected === null) return;
    setBusy("mint"); setError("");
    try { setResult(await (onChoose ? onChoose(selected) : contract.chooseMintSlot(pack.life_id, selected))); }
    catch (cause) {
      const life = await contract.getLife(pack.life_id).catch(() => null);
      const token = life?.status === "minted" ? (await contract.tokensOf(life.account_id).catch(() => [])).find(t => t.extra.life_id === pack.life_id) : null;
      if (token) setResult({ token_id: token.token_id, kind: token.extra.kind, figure_id: token.extra.figure_id, rarity: token.extra.rarity, affection: token.extra.affection });
      else setError(errorText(cause, "The mint was not confirmed. Your pack is saved on NEAR; try again."));
    } finally { setBusy(null); }
  }
  if (result) return <MintReveal practice={practice} view={mintRevealView(result, group, { evidence, evidenceUrl: practice ? null : `/api/ranked/evidence/${pack.evidence_hash}`, actionId: selected === null ? null : pack.cards[selected].action_id, txHash })} affection={result.affection} onClose={onClose} />;
  return <section className={`chain-card mint-pack${opened ? " is-open" : ""}`} aria-labelledby="pack-title">
    <p className="chain-kicker">Life #{pack.life_id} · {practice ? "Practice pack · not recorded on NEAR" : "Pack recorded on NEAR"}</p>
    <h1 id="pack-title" tabIndex={-1}>{opened ? "Choose who weaves forward" : "A life. Three possibilities."}</h1>
    <p>{opened ? "Choose one card to keep as your life NFT. The other two return to the story." : "Your three cards are ready. Open the pack to reveal them."}</p>
    {!opened ? <button className={`booster-pack${opening ? " is-opening" : ""}`} type="button" disabled={opening} onClick={() => setOpening(true)}><span className="booster-seal" aria-hidden="true">✦</span><strong>EVERFOLK</strong><span>Weaving fates</span><small>{opening ? "Opening your fate…" : "Open your pack →"}</small></button> : <>
      <div className="augment-cards" role="group" aria-label="Choose one of three mint cards">{pack.cards.map((card, slot) => <article key={slot} className={`augment-slot${selected === slot ? " is-selected" : ""}`} style={{ animationDelay: `${slot * 100}ms` }}>
        <button className="augment-choice" type="button" disabled={Boolean(busy)} aria-pressed={selected === slot} onClick={() => setSelected(slot)}>
          <span className="chain-kicker">Slot {slot + 1} · {rarityLabel(card.rarity)}</span>
          <span className="augment-art">{card.portrait_media ? <img className="stage-card-portrait" src={card.portrait_media} alt={card.character_name ?? "Stage portrait"} /> : card.figure_id ? <FigureArtwork figureId={card.figure_id} /> : <PixelPortrait age={45} seed={`${pack.evidence_hash}:${slot}:${card.rerolled}`} name={GROUP_TITLE[group]} />}</span>
          <strong className="augment-title">{card.figure_id ? figureTitle(card.figure_id) : card.stage_title && card.character_name ? `${card.character_name} · ${card.stage_title}` : GROUP_TITLE[group]}</strong>
          <span className="chain-tag">{card.kind === "figure" ? "Historical figure" : card.stage_id ? `Stage portrait · ${card.stage_title ?? card.stage_id}` : "Person of the city"}</span>
          <strong>{actionName(card.action_id)}</strong><span>{actionDescription(card.action_id)}</span>
          <span className="augment-affection">Affection {card.affection} / 100</span><span className="augment-select">{selected === slot ? "Selected ✓" : "Choose this card"}</span>
        </button>
        <button className="chain-secondary augment-reroll" type="button" disabled={Boolean(busy) || card.rerolled} onClick={() => { void reroll(slot); }}>{busy === `reroll:${slot}` ? (walletPath ? "Confirm in wallet…" : "Confirming…") : card.rerolled ? "Reroll used" : `↻ Reroll · ${formatNear(pack.reroll_fee)} NEAR`}</button>
      </article>)}</div>
      <p className="chain-fine">One optional reroll per slot. A reroll replaces that card permanently. {practice ? "Practice rerolls update this local ledger; no NEAR is spent." : "Every paid reroll is saved on NEAR and added to your total mint fee."}</p>
    </>}
    <div className="pack-receipt"><strong>Total paid: {formatNear(pack.total_fee)} NEAR</strong><span>{pack.source_share_bps / 100}% to source lives by impact; remainder to the protocol treasury. If no sources shaped this life, the treasury receives the fee. Fees are split when you mint or close this life. {walletPath && "Network gas is separate."}</span></div>
    {busy && <p role="status" className="chain-notice">{!walletPath ? "Confirming…" : busy === "mint" ? "Confirm your chosen card in your wallet. Waiting for NEAR…" : "Confirm the reroll payment in your wallet. Waiting for NEAR…"}</p>}
    {error && <p className="chain-error" role="alert">{error}</p>}
    <div className="chain-actions">{opened && <button className="chain-primary" type="button" disabled={Boolean(busy) || selected === null} onClick={() => { void choose(); }}>{busy === "mint" ? "Minting…" : selected === null ? "Select a card above" : `Mint selected card · Slot ${selected + 1}`}<span aria-hidden="true">→</span></button>}<button className="chain-secondary" type="button" disabled={Boolean(busy)} onClick={onClose}>Save pack & leave</button></div>
    <p className="chain-fine">{practice ? "This practice pack lasts while this page stays open. No NEAR is spent." : `Your pack is saved on NEAR. Return from My lives at any time. ${walletPath ? "Final selection asks for wallet approval with 1 yoctoNEAR, plus network gas." : "You’ll confirm your choice first."}`}</p>
    {!practice && <details className="pack-proof"><summary>Verify this pack</summary><p>Life #{pack.life_id} · Signed evidence hash <code>{pack.evidence_hash}</code></p><p>Opening, each reroll, and final selection have separate NEAR transactions. The contract stores the outcomes and enforces the one-reroll limit. Check their receipts from Account details.</p><a href={`/api/ranked/evidence/${pack.evidence_hash}`} target="_blank" rel="noreferrer">View the verified life & choices</a></details>}
  </section>;
}
