import { FIGURE_ROSTER, type FigureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import type { FigureId } from "../../chain/ids.ts";
import type { LivesContract, TokenView } from "./types.ts";

export type FigureOwnership = Partial<Record<FigureId, { copies: (TokenView & { token_id: string })[]; supply: [number, number] }>>;

/** Presentation entries have no implicit contract identity. */
export async function loadFigureOwnership(contract: Pick<LivesContract, "figureCopies" | "figureSupply" | "token">): Promise<FigureOwnership> {
  const deployed = FIGURE_ROSTER.filter((figure): figure is FigureRosterEntry & { legacyFigureId: FigureId } => Boolean(figure.legacyFigureId));
  const rows = await Promise.all(deployed.map(async figure => {
    const id = figure.legacyFigureId;
    const [pool, supply] = await Promise.all([contract.figureCopies(id), contract.figureSupply(id)]);
    const copies = await Promise.all(pool.map(async copy => {
      const token = await contract.token(copy.token_id);
      if (!token) throw new Error("A figure copy could not be read. Reload the directory to try again.");
      return { ...token, token_id: copy.token_id };
    }));
    return [id, { copies, supply }] as const;
  }));
  return Object.fromEntries(rows);
}

export function matchingFigures(query: string, rarity: string = "all"): readonly FigureRosterEntry[] {
  const term = query.trim().toLocaleLowerCase();
  return FIGURE_ROSTER.filter(figure => (rarity === "all" || figure.variants.some(variant => variant.rank === rarity)) &&
    `${figure.name} ${figure.title} ${figure.archetype} ${figure.tags.join(" ")}`.toLocaleLowerCase().includes(term));
}
