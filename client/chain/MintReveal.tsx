import FigureArtwork from "./FigureArtwork.tsx";
import { useId } from "react";
import type { MintRevealView } from "./life-report-model.ts";
import "./life-report.css";

export interface MintRevealProps {
  view: MintRevealView;
  affection: number;
  onClose(): void;
}

/** The kept life: figure or person of the city, its rarity and affection. */
export default function MintReveal({ view, affection, onClose }: MintRevealProps) {
  const headingId = useId();
  return <section className={`chain-card mint-reveal${view.isFigure ? " is-figure" : ""}`} aria-labelledby={headingId}>
    <p className="chain-kicker">{view.kindLabel}</p>
    <h1 id={headingId} tabIndex={-1}>{view.title}</h1>
    <FigureArtwork figureId={view.figureId} />
    <div className="mint-reveal-tags"><span className={`chain-tag${view.isFigure ? " is-figure" : ""}`}>{view.rarityLabel}</span></div>
    <p>{view.lead}</p>
    <div className="mint-reveal-affection">
      <span>{view.affectionText}</span>
      <span className="life-report-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, affection))}%` }} /></span>
    </div>
    <p className="chain-fine">Affection sets how often this life is drawn into other players' stories.</p>
    <div className="chain-actions">
      <a className="chain-primary" href={view.href} onClick={onClose}>See its page<span aria-hidden="true">→</span></a>
      <button className="chain-secondary" type="button" onClick={onClose}>Back to Everfolk</button>
    </div>
  </section>;
}
