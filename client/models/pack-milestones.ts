import { MAX_PACK_CARDS, MIN_PACK_AGE } from "../../chain/pack-count.ts";

/**
 * Duration-based pack milestones (ages 18, 40, 60 -> 1, 2, 3 cards) apply only to legacy ranked worlds that size
 * packs by longevity (`chain/pack-count.ts`). Free-play packs and figure-path worlds award cards only when earned on
 * a historical figure's path (`chain/earned-cards.ts`), so reaching 18, 40 or 60 promises no cards there. Pure.
 */

export interface PackMilestone { age: number; cards: number; title: string; body: string }

export interface PackMilestoneOptions {
  /** True when packs hold only cards earned on figure paths (free play and all figure-path worlds). Defaults to true. */
  earnedOnly?: boolean;
}

const STEPS: readonly { age: number; cards: number }[] = [{ age: MIN_PACK_AGE, cards: 1 }, { age: 40, cards: 2 }, { age: 60, cards: 3 }];

export function packMilestone(age: number, ranked: boolean, options: PackMilestoneOptions = {}): PackMilestone | null {
  if (!ranked || (options.earnedOnly ?? true)) return null;
  const step = STEPS.find(candidate => candidate.age === age);
  if (!step) return null;
  const where = "Weave Mode mints it as real cards on NEAR.";
  const next = STEPS.find(candidate => candidate.age > age);
  const grow = next ? `Live to ${next.age} for ${next.cards} cards. ` : "";
  return age === MIN_PACK_AGE
    ? { age, cards: step.cards, title: "Card pack earned", body: `You reached ${age}: when this life ends, it opens a card pack with ${step.cards} card. ${grow}Every title you earn adds one more, up to ${MAX_PACK_CARDS}. ${where}` }
    : { age, cards: step.cards, title: "Your card pack grew", body: `You reached ${age}: your pack now holds ${step.cards} cards before titles. ${grow}Titles still add one each, up to ${MAX_PACK_CARDS}. ${where}` };
}
