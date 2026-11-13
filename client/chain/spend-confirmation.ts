import { formatNear } from "./near-amount.ts";
import type { ContractCall } from "./types.ts";

/**
 * What the in-game spend sheet says before an email player's NFT action spends NEAR, and the queue that asks
 * one question at a time. Pure: no React, no wallet library.
 */

export interface SpendText { title: string; price: string; note?: string }

const TITLES: Record<string, string> = {
  open_mint_pack: "Mint this life",
  mint_life: "Mint this life",
  choose_mint_slot: "Keep this card",
  buy: "Buy",
  list: "List for sale",
};
const DEFAULT_TITLE = "Confirm this action";
/** NEAR's "explicit approval" deposit: one yoctoNEAR, too small to show as a price. */
const ONE_YOCTO = "1";
const APPROVAL_ONLY = "No NEAR spent";

const DECIMAL = /^\d+$/;

/** True only for a readable zero deposit: such calls are signed without a question. */
export function spendsNothing(deposit: string): boolean {
  return DECIMAL.test(deposit) && BigInt(deposit) === 0n;
}

/** A listing pays nothing but a one-yocto approval, so its sheet shows the asking price instead. */
function priceText(call: ContractCall): string {
  const asking = call.method === "list" ? call.args.price : undefined;
  if (typeof asking === "string" && DECIMAL.test(asking) && BigInt(asking) > 0n) return `Asking price ${formatNear(asking)} NEAR`;
  return call.deposit === ONE_YOCTO ? APPROVAL_ONLY : `${formatNear(call.deposit)} NEAR`;
}

/** Null when the call spends nothing, or when its deposit cannot be read (the queue then refuses it). */
export function confirmText(call: ContractCall): SpendText | null {
  if (!DECIMAL.test(call.deposit) || BigInt(call.deposit) === 0n) return null;
  return { title: TITLES[call.method] ?? DEFAULT_TITLE, price: priceText(call), ...(call.method === "list" ? { note: "Listing is free; the buyer pays this price." } : {}) };
}

export interface SpendRequest { call: ContractCall; text: SpendText; answer(confirmed: boolean): void }
export interface SpendQueue {
  /** Resolves true on Confirm, false on Cancel. */
  request(call: ContractCall): Promise<boolean>;
  /** The question on screen now, or null. */
  current(): SpendRequest | null;
  cancelAll(): void;
  subscribe(listener: () => void): () => void;
}

/** Questions are shown one at a time, in the order they were asked. */
export function createSpendQueue(): SpendQueue {
  let waiting: readonly SpendRequest[] = [];
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };

  return {
    request(call) {
      const text = confirmText(call);
      // No sheet: a zero deposit goes ahead; an unreadable one is refused rather than paid blind.
      if (!text) return Promise.resolve(spendsNothing(call.deposit));
      return new Promise<boolean>(resolve => {
        const entry: SpendRequest = {
          call, text,
          answer(confirmed) {
            if (!waiting.includes(entry)) return;
            waiting = waiting.filter(item => item !== entry);
            resolve(confirmed);
            notify();
          },
        };
        waiting = [...waiting, entry];
        notify();
      });
    },
    current: () => waiting[0] ?? null,
    cancelAll() {
      for (const request of [...waiting]) request.answer(false);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
