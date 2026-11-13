import { cardEditionText, type CardArtwork } from "../models/card-art.ts";
import "../styles/collection-card-art.css";

export interface CollectionCardArtworkProps {
  art: CardArtwork;
  /** Contract serial, or art.exampleEdition for an explicitly labelled catalogue example. */
  editionText?: string | null;
  className?: string;
  loading?: "eager" | "lazy";
}

/** Approved card face with live editions and a decorative Legendary foil finish. */
export default function CollectionCardArtwork({ art, editionText, className = "", loading = "lazy" }: CollectionCardArtworkProps) {
  const serial = cardEditionText(art, editionText);
  return <figure className={`collection-card-art ${className}`} data-card-art={art.slug} data-rarity={art.rarity}>
    <img className="collection-card-art-image" src={art.footerlessSrc} width={art.width} height={art.height}
      loading={loading} decoding="async" alt={`${art.displayTitle} — ${art.subtitle}`} />
    {art.rarity === "legendary" && <span className="collection-card-foil" aria-hidden="true" />}
    <svg className="collection-card-art-edition" viewBox="0 0 900 1260" role="img" aria-label={`Edition ${serial}`}>
      <text x="816" y="1207.344" textAnchor="end" fontFamily="Inter, DM Sans, Arial, sans-serif"
        fontSize="21" letterSpacing="2.1" fill="#eee4ce">{serial}</text>
    </svg>
    <figcaption className="collection-card-art-caption">
      {art.displayTitle}. {art.subtitle}. {art.rarity}. {art.bodyTitle}. {art.bodyText}
    </figcaption>
  </figure>;
}
