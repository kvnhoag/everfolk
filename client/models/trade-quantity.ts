/**
 * The market order's quantity box, kept as text so it can be empty while the player types. Pure.
 *
 * The box reports its whole new value on every keystroke, so cleaning is a function of that value alone: it never
 * prepends or appends to what was there before.
 */

/** Largest quantity when the market gives no limit of its own. */
export const DEFAULT_MAX_ORDER = 500;

/** Digits only, no leading zeros, clamped to `max`; empty stays empty (and "0" is nothing yet). */
export function cleanQuantityText(raw: string, max: number): string {
  const digits = raw.replace(/\D+/g, "").replace(/^0+/, "");
  if (digits === "" || !(max >= 1)) return "";
  // Longer than any safe whole number is certainly above the limit.
  if (digits.length > 15) return String(Math.floor(max));
  return String(Math.min(Number(digits), Math.floor(max)));
}

/** The whole quantity the text stands for; 0 while the box is empty. */
export function quantityOf(text: string): number {
  return text === "" ? 0 : Number(text);
}

export interface TradeLimitFacts {
  side: "buy" | "sell";
  counterparty: "merchant" | "army";
  /** How much of the good the household holds. */
  held: number;
  /** The most the merchant can pay for today, when known. */
  merchantCanBuy?: number;
  /** The merchant's stock of the good, when known. */
  merchantStock?: number;
  /** The market's cap on one order. */
  maxOrder?: number;
}

/** The most the player can order right now: what is held, what the merchant can pay for or has, and the market's cap. */
export function tradeLimit(facts: TradeLimitFacts): number {
  const cap = facts.maxOrder ?? DEFAULT_MAX_ORDER;
  const available = facts.side === "sell"
    ? facts.counterparty === "army" ? facts.held : Math.min(facts.held, facts.merchantCanBuy ?? facts.held)
    : facts.merchantStock ?? 1;
  return Math.max(0, Math.min(cap, available));
}
