import records from "../../research/figure-biographies.json" with { type: "json" };
import { deepFreeze } from "./content.ts";

export interface HistoricalWork { title: string; status: string; note: string }
export interface FigureBiography {
  id: string; title: string; period: string; biography: string;
  authoredWorks: HistoricalWork[];
  otherWorks: { title: string; note: string }[];
  sources: { title: string; url: string }[];
  cautions: string[];
}

/** Historical research records include candidates; they do not add mintable figure ids. */
export const FIGURE_BIOGRAPHIES: readonly FigureBiography[] = deepFreeze(records.figures);

export function biographyFor(id: string): FigureBiography {
  const figure = FIGURE_BIOGRAPHIES.find(record => record.id === id);
  if (!figure) throw new Error(`Missing historical biography: ${id}`);
  return figure;
}
