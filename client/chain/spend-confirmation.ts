import { formatNear } from "./near-amount.ts";
import type { ContractCall } from "./types.ts";

/**
 * What the in-game spend sheet says before an email player's NFT action spends NEAR, and the queue that asks
 * one question at a time. Pure: no React, no wallet library.
 */

export interface SpendText { title: string; price: string }

const TITLES: Record<string, string> = {
  open_mint_pack: "Mint this life",
  mint_life: "Mint this life",
  reroll_mint_slot: "Reroll this card",
  choose_mint_slot: "Keep this card",
  buy: "Buy",
  list: "List for sale",
};
const DEFAULT_TITLE = "Confirm this action";
/** NEAR's "explicit approval" deposit: one yoctoNEAR, too small to show as a price. */
const ONE_YOCTO = "1";
const APPROVAL_ONLY = "No NEAR spent";

/** Null when the call spends nothing, so it is signed without a question. */
export function confirmText(call: ContractCall): SpendText | null {
  if (!/^\d+$/.test(call.deposit) || BigInt(call.deposit) === 0n) return null;
  const price = call.deposit === ONE_YOCTO ? APPROVAL_ONLY : `${formatNear(call.deposit)} NEAR`;
  return { title: TITLES[call.method] ?? DEFAULT_TITLE, price };
}

export interface SpendRequest { call: ContractCall; text: SpendText; answer(confirmed: boolean): void }
export interface SpendQueue {
  /** Resolves true on Confirm, false on Cancel. */
  request(call: ContractCall): Promise<boolean>;
  /** The question on screen now, or null. */
  current(): SpendRequest | null;
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
      if (!text) return Promise.resolve(true);
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
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
