/**
 * Track F — offer events. An agent's offer sets `demo.offer`; the matching event below becomes eligible
 * and the engine offers it as a dated decision. Event text is static, so it names the offer plainly and
 * the exact quantity and price appear in the journal line written when the player answers.
 */
import type { Choice, LifeEvent } from "../../types.ts";
import type { OfferKind } from "../types.ts";
import { OFFERS } from "../types.ts";
import type { DemoContent } from "./types.ts";

/**
 * The world's first calendar year (`alexandria-ranked-1` starts in 350 BC). Scheduled events may only
 * occur once, so `applyOffer` re-opens the event after each answer (see agents.ts).
 */
export const OFFER_EVENT_YEAR = -350;

export function offerEventId(kind: OfferKind): string {
  return `agent-offer-${kind}`;
}

const OFFER_COPY: Record<OfferKind, { title: string; text: string; accept: string; decline: string }> = {
  "grain-contract": {
    title: "A grain contract",
    text: "A townsperson offers to buy grain from your store at a stated price per measure, paid in drachmas on the spot.",
    accept: "Sell the grain at the offered price",
    decline: "Keep your grain",
  },
  "seed-credit": {
    title: "Seed grain on credit",
    text: "A townsperson offers you grain now, to be paid for later. The price is added to your household debt.",
    accept: "Take the grain on credit",
    decline: "Do without the credit",
  },
  "convoy-job": {
    title: "A convoy job",
    text: "A townsperson offers you pay in drachmas to guard a grain convoy on the road. Only a serving soldier can take it.",
    accept: "Take the convoy job",
    decline: "Turn the job down",
  },
  "goods-deal": {
    title: "A goods deal",
    text: "The merchant offers you trade goods at a stated price per unit, paid in drachmas.",
    accept: "Buy the goods at the offered price",
    decline: "Keep your drachmas",
  },
};

function answer(kind: OfferKind, action: "accept" | "decline", text: string): Choice {
  return {
    id: `${action}-${kind}`,
    text,
    ...(action === "accept" && kind === "convoy-job" ? { when: { type: "job" as const, job: "soldier" } } : {}),
    outcomes: [{
      id: `${action}-${kind}-answered`,
      text: action === "accept" ? "You give your answer and the terms are settled." : "You send word that you will not take it.",
      weight: 1,
      effects: [{ type: "demo", effect: { kind: "offer", action } }],
    }],
  };
}

function offerEvent(kind: OfferKind): LifeEvent {
  const copy = OFFER_COPY[kind];
  return {
    id: offerEventId(kind),
    title: copy.title,
    text: copy.text,
    trigger: { type: "year", at: OFFER_EVENT_YEAR },
    when: { type: "demo", condition: { kind: "offer", offer: kind } },
    choices: [answer(kind, "accept", copy.accept), answer(kind, "decline", copy.decline)],
  };
}

export const AGENTS_CONTENT: DemoContent = {
  events: OFFERS.map(offerEvent),
};
