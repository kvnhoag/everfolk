import { type ReactNode } from "react";
import type { FigureId } from "../../chain/ids.ts";
import FigureArtwork from "./FigureArtwork.tsx";
import PixelPortrait from "../components/PixelPortrait.tsx";
import PixelIcon from "../components/PixelIcon.tsx";
import StorybookMark from "../components/StorybookMark.tsx";
import EverfolkWordmark from "../components/EverfolkWordmark.tsx";
import { audioManager } from "../lib/audio-manager.ts";
import "./everfolk-card.css";

export interface EverfolkCardProps {
  /** When true, shows card back facing user (or flipping). */
  isFaceDown?: boolean;
  /** Triggered when user clicks a face-down card to reveal it. */
  onFlip?(): void;
  /** General click handler on the card (e.g. selection or inspection). */
  onClick?(): void;
  /** Card is currently selected (for booster pack minting or deck view). */
  selected?: boolean;
  /** Card is uncollected silhouette (pokemonsim set style). */
  isSilhouette?: boolean;
  tokenId?: string;
  slotNumber?: number;
  title: string;
  subtitle?: string;
  isFigure?: boolean;
  figureId?: FigureId | null;
  portraitMedia?: string | null;
  pixelSeed?: string;
  rarity?: number | null;
  rarityLabel?: string;
  actionName?: string;
  actionDescription?: string;
  affection?: number;
  priceNear?: string;
  actions?: ReactNode;
  interactive?: boolean;
  className?: string;
  badge?: string;
}

export default function EverfolkCard({
  isFaceDown = false,
  onFlip,
  onClick,
  selected = false,
  isSilhouette = false,
  tokenId,
  slotNumber,
  title,
  subtitle,
  isFigure = false,
  figureId,
  portraitMedia,
  pixelSeed,
  rarity = 1,
  rarityLabel,
  actionName,
  actionDescription,
  affection,
  priceNear,
  actions,
  interactive = true,
  className = "",
  badge,
}: EverfolkCardProps) {
  const rarityNum = rarity ?? (isFigure ? 5 : 1);
  const displayRarity = rarityLabel ?? (isFigure ? "Historical Figure" : rarityNum >= 4 ? "Legendary" : rarityNum === 3 ? "Epic" : rarityNum === 2 ? "Rare" : "Common");

  const handleCardClick = () => {
    if (!interactive) return;
    if (isFaceDown) {
      audioManager.playClickSound();
      onFlip?.();
    } else {
      audioManager.playClickSound();
      onClick?.();
    }
  };

  return (
    <div className={`ef-card-perspective ${className}`}>
      <div
        className={`ef-card-inner ${isFaceDown ? "is-face-down" : "is-flipped"} ${selected ? "is-selected" : ""}`}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={handleCardClick}
        onKeyDown={e => {
          if (interactive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleCardClick();
          }
        }}
        aria-label={isFaceDown ? `Unrevealed fate card${slotNumber ? ` slot ${slotNumber}` : ""}. Click to flip.` : `${title}, ${displayRarity}`}
      >
        {/* Card Back: Ancient Rhakotis Celestial pattern */}
        <div className="ef-card-face ef-card-back">
          <div className="ef-card-back-corners" aria-hidden="true" />
          <div className="ef-card-back-topline">RHAKOTIS · WEAVING FATES</div>
          <div className="ef-card-back-center">
            <div className="ef-card-back-medallion">
              <StorybookMark size={46} />
            </div>
            <strong className="ef-card-back-brand"><EverfolkWordmark tone="cream" /></strong>
            <span className="ef-card-back-realm">ANCIENT CHRONICLES</span>
          </div>
          <div className="ef-card-back-prompt">
            <span aria-hidden="true">✦</span>
            <span>Click to reveal fate</span>
            <span aria-hidden="true">✦</span>
          </div>
        </div>

        {/* Card Front: High-res collectible card */}
        <div
          className={`ef-card-face ef-card-front rarity-${rarityNum} ${isFigure ? "is-figure" : ""} ${isSilhouette ? "is-silhouette" : ""}`}
        >
          <header className="ef-card-header">
            <span className="ef-card-num">
              {slotNumber ? `SLOT ${slotNumber}` : tokenId ? `№ ${tokenId}` : "COLLECTIBLE"}
            </span>
            <span className={`ef-card-badge rarity-${rarityNum} ${isFigure ? "is-figure" : ""}`}>
              {badge ?? (isFigure ? "👑 FIGURE" : `✦ ${displayRarity}`)}
            </span>
          </header>

          <div className="ef-card-portrait-wrap">
            {portraitMedia ? (
              <img className="stage-card-portrait" src={portraitMedia} alt={title} />
            ) : figureId ? (
              <FigureArtwork figureId={figureId} />
            ) : (
              <PixelPortrait
                age={36}
                seed={pixelSeed ?? `${title}:${tokenId ?? slotNumber ?? 1}`}
                name={title}
              />
            )}
          </div>

          <div className="ef-card-identity">
            <strong className="ef-card-title ef-type-display" title={title}>
              {title}
            </strong>
            <span className="ef-card-kind">
              {subtitle ?? (isFigure ? "Historical Figure" : "Citizen of Rhakotis")}
            </span>
          </div>

          {(actionName || actionDescription) && (
            <div className="ef-card-deed">
              <strong className="ef-card-deed-title">
                <PixelIcon name="scroll" size={14} />
                <span>{actionName ?? "Deed of Rhakotis"}</span>
              </strong>
              {actionDescription && <p className="ef-card-deed-desc">{actionDescription}</p>}
            </div>
          )}

          <div className="ef-card-stats">
            {affection !== undefined ? (
              <div className="ef-card-affection" title={`Affection score: ${affection}/100`}>
                <PixelIcon name="heart" size={12} />
                <span>{affection}/100</span>
                <span className="ef-card-affection-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.min(100, affection))}%` }} />
                </span>
              </div>
            ) : (
              <span className="ef-card-num">RHAKOTIS</span>
            )}

            {priceNear && (
              <span className="ef-card-price" title={`Listing price: ${priceNear} NEAR`}>
                {priceNear} NEAR
              </span>
            )}
          </div>

          {actions && (
            <div className="ef-card-actions" onClick={e => e.stopPropagation()}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
