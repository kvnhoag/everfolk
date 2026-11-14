import { MAX_PACK_CARDS, MIN_PACK_AGE } from "../../chain/pack-count.ts";

/**
 * The moments a life's card pack grows, shown as they happen: from 18 the life opens a pack when it ends, and living
 * to 40 and 60 adds a card each (titles add one more each, up to the maximum). Mirrors chain/pack-count.ts. Pure.
 */

export interface PackMilestone { age: number; cards: number; title: string; body: string }

const STEPS: readonly { age: number; cards: number }[] = [{ age: MIN_PACK_AGE, cards: 1 }, { age: 40, cards: 2 }, { age: 60, cards: 3 }];

export function packMilestone(age: number, ranked: boolean): PackMilestone | null {
  const step = STEPS.find(candidate => candidate.age === age);
  if (!step) return null;
  const where = ranked ? "Weave Mode mints it as real cards on NEAR." : "This guest life shows you the pack; a Weave Mode life mints it as real cards.";
  const next = STEPS.find(candidate => candidate.age > age);
  const grow = next ? `Live to ${next.age} for ${next.cards} cards. ` : "";
  return age === MIN_PACK_AGE
    ? { age, cards: step.cards, title: "Card pack earned", body: `You reached ${age}: when this life ends, it opens a card pack with ${step.cards} card. ${grow}Every title you earn adds one more, up to ${MAX_PACK_CARDS}. ${where}` }
    : { age, cards: step.cards, title: "Your card pack grew", body: `You reached ${age}: your pack now holds ${step.cards} cards before titles. ${grow}Titles still add one each, up to ${MAX_PACK_CARDS}. ${where}` };
}
