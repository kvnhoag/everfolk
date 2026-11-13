import type { LegacyEntry } from "../storage/legacy-store.ts";

export interface FigureCardGroup {
  figure: { id: string; name: string };
  entries: LegacyEntry[];
}

/** Groups already-filtered records for display without awarding or merging work. */
export function groupFigureCards(entries: readonly LegacyEntry[]): {
  figures: FigureCardGroup[];
  otherEntries: LegacyEntry[];
} {
  const byFigure = new Map<string, FigureCardGroup>();
  const otherEntries: LegacyEntry[] = [];
  for (const entry of entries) {
    const figure = entry.accomplishment.figure;
    if (!figure) {
      otherEntries.push(entry);
      continue;
    }
    let group = byFigure.get(figure.id);
    if (!group) {
      group = { figure: { ...figure }, entries: [] };
      byFigure.set(figure.id, group);
    }
    group.entries.push(entry);
  }
  return { figures: [...byFigure.values()], otherEntries };
}
