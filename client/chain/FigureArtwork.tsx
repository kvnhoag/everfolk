import type { FigureId } from "../../chain/ids.ts";
import { figureMediaPath } from "../../chain/figure-media.ts";
import { figureTitle } from "./chain-copy.ts";
import { getFigureCardArt } from "../models/card-art.ts";
import CollectionCardArtwork from "../components/CollectionCardArtwork.tsx";
import "./figure-artwork.css";

/** The same creator export is used by the reveal, kept life and market. */
export default function FigureArtwork({ figureId, rarity, editionText, fullCard = false }: {
  figureId?: FigureId | null; rarity?: number | string; editionText?: string | null; fullCard?: boolean;
}) {
  if (!figureId) return null;
  const art = getFigureCardArt(figureId, rarity);
  if (fullCard && art) return <div className="figure-artwork is-approved-card"><CollectionCardArtwork art={art} editionText={editionText} loading="eager" /></div>;
  return <img className="figure-artwork" src={art?.portraitSrc ?? figureMediaPath(figureId)} width={art ? 840 : 480} height={art ? 1050 : 640} alt={`${figureTitle(figureId)} collectible card`} />;
}
