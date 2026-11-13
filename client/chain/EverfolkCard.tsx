import { type ReactNode } from "react";
import { RARITY_LABELS, type FigureId } from "../../chain/ids.ts";
import { getFigureCardArt } from "../models/card-art.ts";
import CollectionCardArtwork from "../components/CollectionCardArtwork.tsx";
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
  /** The recorded copy serial, never a token id or the artwork's example number. */
  editionText?: string | null;
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
  rarity,
  rarityLabel,
  editionText,
  actionName,
  actionDescription,
  affection,
  priceNear,
  actions,
  interactive = true,
  className = "",
  badge,
}: EverfolkCardProps) {
  const customPortrait = portraitMedia && !/\/assets\/figures\/[^/]+\.png(?:[?#].*)?$/.test(portraitMedia);
  const collectionArt = isFigure && figureId && !customPortrait ? getFigureCardArt(figureId, rarity ?? undefined) : undefined;
  const artRarity = collectionArt ? ["common", "uncommon", "rare", "epic", "legendary"].indexOf(collectionArt.rarity) : -1;
  const rarityNum = rarity ?? (artRarity >= 0 ? artRarity : isFigure ? 4 : 1);
  const displayRarity = rarityLabel ?? RARITY_LABELS[rarityNum] ?? "Common";

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
    <div className={`ef-card-perspective ${collectionArt ? "has-collection-art" : ""} ${className}`}>
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
        {collectionArt ? <div className={`ef-card-face ef-card-front is-collection-art rarity-${rarityNum} ${isSilhouette ? "is-silhouette" : ""}`}>
          <CollectionCardArtwork art={collectionArt} editionText={editionText} />
        </div> : <div
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
        </div>}
      </div>
      {collectionArt && !isFaceDown && (badge || affection !== undefined || priceNear || actions) && <div className="ef-card-collection-details">
        {(badge || affection !== undefined || priceNear) && <div className="ef-card-collection-facts">
          {badge && <span>{badge}</span>}
          {affection !== undefined && <span>Affection {affection}/100</span>}
          {priceNear && <strong>{priceNear} NEAR</strong>}
        </div>}
        {actions && <div className="ef-card-actions" onClick={event => event.stopPropagation()}>{actions}</div>}
      </div>}
    </div>
  );
}
