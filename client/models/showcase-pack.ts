import { allCardArt, CARD_ART_RANKS, cardEditionText } from "./card-art.ts";
import type { BoosterCardView } from "../types/booster.ts";

const legendaryCards = allCardArt.filter(art => art.rarity === "legendary");

/** Five distinct preview cards with at least one Legendary, independent of earned rewards. */
export function createShowcasePackCards(random: () => number = Math.random): BoosterCardView[] {
  const legendary = legendaryCards[Math.floor(random() * legendaryCards.length)];
  const pool = allCardArt.filter(art => art.id !== legendary.id);
  const cards = [legendary];
  while (cards.length < 5) cards.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);

  // The guaranteed Legendary can appear anywhere, and the other draws may be Legendary too.
  for (let index = cards.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards.map(art => ({
    name: art.displayTitle,
    rarity: CARD_ART_RANKS.indexOf(art.rarity),
    art: art.portraitSrc,
    framedArt: art.footerlessSrc,
    editionText: cardEditionText(art),
    sub: art.subtitle,
  }));
}
