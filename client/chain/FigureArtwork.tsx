import type { FigureId } from "../../chain/ids.ts";
import { figureMediaPath } from "../../chain/figure-media.ts";
import { figureTitle } from "./chain-copy.ts";
import "./figure-artwork.css";

/** The same creator export is used by the reveal, kept life and market. */
export default function FigureArtwork({ figureId }: { figureId?: FigureId | null }) {
  if (!figureId) return null;
  return <img className="figure-artwork" src={figureMediaPath(figureId)} width={480} height={640} alt={`${figureTitle(figureId)} collectible card`} />;
}
