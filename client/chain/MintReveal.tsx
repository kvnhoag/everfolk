import { useId, useState } from "react";
import PixelIcon from "../components/PixelIcon.tsx";
import FigureArtwork from "./FigureArtwork.tsx";
import type { MintRevealView } from "./life-report-model.ts";
import type { BoosterCardView } from "../types/booster.ts";
import NftCardViewer from "./NftCardViewer.tsx";
import "./life-report.css";
import "./ledger.css";

export interface MintRevealProps {
  practice?: boolean;
  view: MintRevealView;
  affection: number;
  /** The minted NFT as a 3D card. When given, the result opens in 3D first; the details follow. */
  card?: BoosterCardView;
  onClose(): void;
}

/** The kept life as a ledger entry: its card, what it is, how it acts, and where it is recorded on NEAR. */
export default function MintReveal({ view, affection, card, practice = false, onClose }: MintRevealProps) {
  const headingId = useId();
  const [viewing3d, setViewing3d] = useState(Boolean(card));
  if (card && viewing3d) return <NftCardViewer cards={[card]} onClose={() => setViewing3d(false)} />;
  return <section className={`ledger-panel mint-reveal mint-reveal-ledger${view.isFigure ? " is-figure" : ""}`} aria-labelledby={headingId}>
    <header className="ledger-heading">
      <p className="ledger-kicker"><span className="cr-index">{view.number}</span>{view.kindLabel} · {practice ? "practice collectible" : "kept on NEAR"}</p>
      <h1 id={headingId} tabIndex={-1}>{view.title}</h1>
      <p>{view.lead}</p>
    </header>
    <div className="ledger-body">
      {view.portraitMedia
        ? <div className="mint-reveal-portrait"><img src={view.portraitMedia} alt={view.title} className="stage-reveal-portrait" /></div>
        : view.figureId
        ? <FigureArtwork figureId={view.figureId} />
        : <div className="ledger-emblem" aria-hidden="true"><PixelIcon name={view.emblem ?? "sun"} size={64} /><span>{view.kindLabel}</span></div>}
      <ol className="ledger-rows">{view.rows.map(row => <li className="ledger-row" key={row.label}>
        <span className="ledger-label">{row.label}</span>
        <span className="ledger-value">
          <strong>{row.value}</strong>
          {row.label === "Affection" && <span className="ledger-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, affection))}%` }} /></span>}
          {row.detail && <span className="ledger-detail">{row.detail}</span>}
          {row.chips && <ul className="ledger-chips">{row.chips.map(chip => <li className="ledger-chip is-faience" key={chip}>{chip}</li>)}</ul>}
        </span>
      </li>)}</ol>
    </div>
    {view.links.length > 0 && <p className="ledger-links">{view.links.map(link => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</p>}
    <div className="ledger-actions">
      <a className="chain-primary" href={view.href} onClick={onClose}>See its page<span aria-hidden="true">→</span></a>
      {card && <button className="chain-secondary" type="button" onClick={() => setViewing3d(true)}>View in 3D</button>}
      <button className="chain-secondary" type="button" onClick={onClose}>Back to Everfolk</button>
    </div>
  </section>;
}
