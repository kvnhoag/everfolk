import type { FigureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import { orderedVariantRanks, type CardRarity } from "./figure-card-carousel.ts";

/** Available variants describe the catalogue, never a newly earned rank. */
export function cardVariantLabel(ranks: readonly CardRarity[]): string {
  const ordered = orderedVariantRanks([...new Set(ranks)]);
  return ordered.length > 1 ? `${ordered[0]}–${ordered[ordered.length - 1]}` : ordered[0] ?? "";
}

export function figureRarityLabel(figure: FigureRosterEntry): string {
  return cardVariantLabel(figure.variants.map(variant => variant.rank));
}
