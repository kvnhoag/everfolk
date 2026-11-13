import type { CSSProperties } from "react";
import HistoricalFigureCard, { displayedFigureCardRank, type HistoricalFigureCardProps } from "./HistoricalFigureCard.tsx";
import { variantStackSlot } from "../models/figure-card-carousel.ts";
import { figureCardRanks } from "../models/figure-contribution-ranks.ts";
import { cardVariantLabel } from "../models/figure-card-labels.ts";
import { findCardArt, cardArtRank } from "../models/card-art.ts";
import "../styles/figure-card-stack.css";

export interface FigureCardStackProps extends Omit<HistoricalFigureCardProps, "onInspect"> {
  onInspect: NonNullable<HistoricalFigureCardProps["onInspect"]>;
  /** Saved cards keep their recorded rank; adjacent versions are inspection previews. */
  recorded?: boolean;
}

/** A single inspection target advertises every legal version without awarding any of them. */
export default function FigureCardStack({ figure, rank: requested, mode = "principal", contributionRanks, title, traits, onInspect, compact = false, className = "", recorded = false, gender, artSeed }: FigureCardStackProps) {
  const rank = displayedFigureCardRank(figure, requested, mode, contributionRanks);
  const variants = figureCardRanks(figure, mode, contributionRanks);
  const range = cardVariantLabel(variants);
  const selected = variants.indexOf(rank);
  const count = variants.length;
  const approved = findCardArt({ figureId: figure.id, kind: mode === "contribution" ? "contribution" : "parent", tier: cardArtRank(rank) });
  return <div className={`figure-card-preview-stack${compact ? " is-compact" : ""}${count > 1 ? " has-variants" : ""}${className ? " " + className : ""}`} data-figure-stack={figure.id} data-placeholder-art={!approved && figure.art.placeholder ? "true" : undefined} data-current-rarity={rank} data-variant-count={count}>
    <div className="figure-preview-rarity-heading"><strong>{range}</strong><span>{count} {count === 1 ? "rarity" : "rarities"}</span></div>
    <div className="figure-preview-stage" aria-hidden="true">
      <div className="figure-preview-plane">
        {variants.map((variant, index) => {
          const slot = variantStackSlot(index, selected, count);
          const current = slot === 0;
          return <div key={variant} className={`figure-preview-layer${current ? " is-current" : ""}`} data-preview-rank={variant} data-preview-slot={slot} style={{ "--preview-slot": slot, "--preview-depth": Math.abs(slot), zIndex: count - Math.abs(slot) } as CSSProperties}>
            <HistoricalFigureCard figure={figure} rank={variant} mode={mode} contributionRanks={variants} title={current ? title : mode === "contribution" ? `${figure.name} · Contributor` : undefined} traits={traits} compact={compact} gender={gender} artSeed={artSeed} />
            {!current && <span className={`figure-preview-edge${slot < 0 ? " is-left" : ""}`}>{variant}</span>}
          </div>;
        })}
      </div>
    </div>
    <p className="figure-preview-rank-note">{recorded ? <>Recorded: <strong>{rank}</strong><span>Other versions are previews</span></> : <>Available rarity {count === 1 ? "version" : "versions"}</>}</p>
    <button type="button" className="figure-preview-open" aria-haspopup="dialog" aria-label={`Inspect ${figure.name}: ${rank}${mode === "contribution" ? " contribution" : ""} card. Available variants: ${range}.${recorded ? ` Recorded rank: ${rank}.` : ""} Press to preview.`} onClick={() => onInspect(rank)}>
      <span className="figure-preview-prompt"><svg viewBox="0 0 20 20" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><circle cx={8.5} cy={8.5} r={5.5} /><path d="m12.5 12.5 4.5 4.5M8.5 5.5v6m-3-3h6" /></svg><span>Press to preview</span><span aria-hidden="true">↗</span></span>
    </button>
  </div>;
}
