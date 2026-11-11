import { CATEGORIES, type Category } from "../../chain/ids.ts";

/** Input checks shared by the contract client and the mock, worded like the contract's own errors. */

const U64_MAX = (1n << 64n) - 1n;
const U32_MAX = 2 ** 32 - 1;

export function assertLifeId(lifeId: string): void {
  if (typeof lifeId !== "string" || !/^\d{1,20}$/.test(lifeId) || BigInt(lifeId) > U64_MAX) {
    throw new Error(`"${String(lifeId)}" is not a valid life id.`);
  }
}

export function assertStep(step: number): void {
  if (!Number.isInteger(step) || step < 0 || step > U32_MAX) throw new Error(`The command step must be a whole number from 0, got ${step}.`);
}

export function assertCommandsHash(hash: string): void {
  if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) throw new Error("Commands hash must be 64 lowercase hex characters");
}

export function assertCategory(category: string): asserts category is Category {
  if (!(CATEGORIES as readonly string[]).includes(category)) throw new Error(`Unknown category: ${category}`);
}

export function assertTokenId(tokenId: string): void {
  if (typeof tokenId !== "string" || !tokenId.trim()) throw new Error("A token id is required.");
}

/** Whole yoctoNEAR amount as a decimal string, above zero. */
export function assertPrice(priceYocto: string): void {
  if (typeof priceYocto !== "string" || !/^\d{1,40}$/.test(priceYocto) || BigInt(priceYocto) === 0n) {
    throw new Error(`The price must be a whole number of yoctoNEAR above zero, got "${String(priceYocto)}".`);
  }
}

export function assertAccountId(account: string): void {
  if (typeof account !== "string" || !/^[a-z\d._-]{2,64}$/.test(account)) throw new Error(`"${String(account)}" is not a NEAR account.`);
}
