import type { FigureCardRank, FigureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import { figureCardRanks } from "../models/figure-contribution-ranks.ts";
import { findCardArt, cardArtRank, type CardArtGender } from "../models/card-art.ts";
import CollectionCardArtwork from "./CollectionCardArtwork.tsx";
import "../styles/figure-cards.css";

export type FigureCardMode = "principal" | "contribution";
export interface FigureCardTrait { id: string; label: string; earned?: boolean }
export interface HistoricalFigureCardProps {
  figure: FigureRosterEntry;
  rank?: FigureCardRank;
  mode?: FigureCardMode;
  /** Grades from the exact authored world, including retained contribution records. */
  contributionRanks?: readonly FigureCardRank[];
  title?: string;
  traits?: readonly FigureCardTrait[];
  onInspect?(rank: FigureCardRank): void;
  compact?: boolean;
  className?: string;
  gender?: CardArtGender;
  artSeed?: string;
}
const rankStones: Record<FigureCardRank, number> = { Common: 1, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 };

/** A preview cannot invent a principal variant or promote a contributor above Epic. */
export function displayedFigureCardRank(figure: FigureRosterEntry, requested?: FigureCardRank, mode: FigureCardMode = "principal", contributionRanks?: readonly FigureCardRank[]): FigureCardRank {
  const allowed = figureCardRanks(figure, mode, contributionRanks);
  return requested && allowed.includes(requested) ? requested : mode === "contribution" ? allowed[0] : figure.baseRank;
}

/** Editable frame/type stay separate from the approved or temporary portrait image. */
export default function HistoricalFigureCard({ figure, rank: requested, mode = "principal", contributionRanks, title, traits, onInspect, compact = false, className = "", gender, artSeed }: HistoricalFigureCardProps) {
  const rank = displayedFigureCardRank(figure, requested, mode, contributionRanks);
  const cardTitle = title ?? (mode === "contribution" ? `${figure.name} · Contributor` : figure.name);
  const cardTraits: readonly FigureCardTrait[] = traits ?? figure.tags.slice(0, 3).map((label, index) => ({ id: "tag-" + index, label }));
  const art = findCardArt({ figureId: figure.id, kind: mode === "contribution" ? "contribution" : "parent", tier: cardArtRank(rank), gender, seed: artSeed });
  const classes = `figure-tcg-card figure-tcg-card--${rank.toLowerCase()}${art ? " figure-tcg-card--approved" : ""}${compact ? " figure-tcg-card--compact" : ""}${onInspect ? " figure-tcg-card--interactive" : ""}${className ? " " + className : ""}`;
  const content = art ? <>
    <CollectionCardArtwork art={art} />
    <span className="figure-card-sr-only">{cardTitle}. {figure.archetype}. {mode === "contribution" ? "Contribution" : "Historical figure"}. <span>{rank}</span>.
      {cardTraits.map(trait => <span key={trait.id}>{trait.earned === false ? "Requires proof: " : ""}{trait.label}. </span>)}
    </span>
    {onInspect && <span className="figure-tcg-inspect figure-card-sr-only">Inspect</span>}
  </> : <>
    <span className="figure-tcg-topline"><span className="figure-tcg-series">{mode === "contribution" ? "Contribution" : "Historical figure"}</span><span className="figure-tcg-stones" aria-hidden="true">{Array.from({ length: rankStones[rank] }, (_, index) => <i key={index} />)}</span></span>
    <span className="figure-tcg-title">{cardTitle}</span>
    <span className="figure-tcg-art">
      <svg className="figure-tcg-architecture" viewBox="0 0 240 260" aria-hidden="true"><path d="M22 240V55h196v185M15 55l105-38 105 38M36 230V76m168 154V76M36 94h168M36 214h168M15 240h210" fill="none" /></svg>
      <img src={figure.art.src} width={192} height={288} loading="lazy" decoding="async" alt={figure.art.placeholder ? `${figure.name} placeholder portrait` : `${figure.name} portrait artwork`} />
      {figure.art.placeholder && <span className="figure-tcg-placeholder">Placeholder art</span>}
      <span className="figure-tcg-art-rule" aria-hidden="true" />
    </span>
    <span className="figure-tcg-caption"><span>{figure.archetype}</span><strong>{rank}</strong></span>
    <span className="figure-tcg-traits">{cardTraits.slice(0, 3).map(trait => <span className={trait.earned === true ? "is-earned" : trait.earned === false ? "is-pending" : ""} title={trait.earned === false ? "Requires proof" : undefined} key={trait.id}>{trait.earned === false && <span aria-hidden="true">◇ </span>}{trait.earned === false && <span className="figure-card-sr-only">Requires proof: </span>}{trait.label}</span>)}</span>
    <span className="figure-tcg-footer"><span>EVERFOLK · {figure.id.toUpperCase()}</span>{onInspect && <span className="figure-tcg-inspect">Inspect <span aria-hidden="true">↗</span></span>}</span>
  </>;
  return onInspect
    ? <button type="button" className={classes} data-figure-card={figure.id} data-rarity={rank.toLowerCase()} aria-label={`Inspect ${figure.name}: ${rank}${mode === "contribution" ? " contribution" : ""} card`} onClick={() => onInspect(rank)}>{content}</button>
    : <article className={classes} data-figure-card={figure.id} data-rarity={rank.toLowerCase()} aria-label={`${cardTitle}, ${rank} ${mode === "contribution" ? "contribution" : "historical figure"} card`}>{content}</article>;
}
