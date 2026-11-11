import { FIGURE_ACTIONS, NPC_ACTIONS } from "../../chain/ids.ts";
import type { SourceImpact, SourceShare } from "../../chain/types.ts";
import { bpsOf, computeShares, splitAmount } from "./mock-math.ts";
import { addToPool, groupOfNpcAction, type MockState } from "./mock-state.ts";
import { assertPrice } from "./validate.ts";

/** Earnings, actions and the in-game market of the mock ledger. Mirrors earnings.rs, tokens.rs and market.rs. */

function credit(state: MockState, account: string, amount: bigint): void {
  if (amount > 0n) state.balances.set(account, (state.balances.get(account) ?? 0n) + amount);
}

function ownerOf(state: MockState, tokenId: string): string {
  const token = state.tokens.get(tokenId);
  if (!token) throw new Error("Token not found");
  return token.owner_id;
}

function assertTokenOwner(state: MockState, account: string, tokenId: string): string {
  const owner = ownerOf(state, tokenId);
  if (owner !== account) throw new Error("Only the token's owner can do this");
  return owner;
}

/** Credits each source's current owner and returns the total paid. */
function creditSources(state: MockState, shares: readonly SourceShare[], amount: bigint): bigint {
  let paid = 0n;
  for (const { token_id, part } of splitAmount(amount, shares)) {
    credit(state, ownerOf(state, token_id), part);
    paid += part;
    const stats = state.stats.get(token_id) ?? { lives_influenced: 0, earned: 0n };
    state.stats.set(token_id, { ...stats, earned: stats.earned + part });
  }
  return paid;
}

/** Fixes the child's source shares, records the reverse index and splits the mint fee. Returns the shares. */
export function payMintFee(state: MockState, child: string, impacts: readonly SourceImpact[]): SourceShare[] {
  const shares = computeShares(impacts);
  const fee = state.params.mintFee;
  state.sources.set(child, shares);
  for (const { token_id } of shares) {
    const stats = state.stats.get(token_id) ?? { lives_influenced: 0, earned: 0n };
    state.stats.set(token_id, { ...stats, lives_influenced: stats.lives_influenced + 1 });
    state.children.set(token_id, [...(state.children.get(token_id) ?? []), child]);
  }
  const paid = creditSources(state, shares, bpsOf(fee, state.params.sourceMintShareBps));
  credit(state, state.params.treasuryId, fee - paid);
  return shares;
}

export function withdraw(state: MockState, account: string): void {
  if ((state.balances.get(account) ?? 0n) === 0n) throw new Error("Nothing to withdraw");
  state.balances.delete(account);
}

export function setAction(state: MockState, account: string, tokenId: string, actionId: string): void {
  assertTokenOwner(state, account, tokenId);
  const token = state.tokens.get(tokenId);
  if (!token) throw new Error("Token not found");
  if (token.kind === "figure") {
    const menu: readonly string[] = token.figure_id ? FIGURE_ACTIONS[token.figure_id] : [];
    if (!menu.includes(actionId)) throw new Error("This action is not on this token's menu");
  } else {
    const group = groupOfNpcAction(token.action_id);
    if (!group || groupOfNpcAction(actionId) !== group) throw new Error("This action is not on this token's menu");
  }
  const category = token.kind === "npc" ? NPC_ACTIONS[groupOfNpcAction(actionId) ?? "letters"].category : null;
  const updated = { ...token, action_id: actionId, category, extra: { ...token.extra, action_id: actionId } };
  if (category && category !== token.category && token.category) {
    state.npcPools.set(token.category, (state.npcPools.get(token.category) ?? []).filter(id => id !== tokenId));
    addToPool(state, tokenId, updated);
  }
  state.tokens.set(tokenId, updated);
}

export function list(state: MockState, account: string, tokenId: string, priceYocto: string): void {
  const seller = assertTokenOwner(state, account, tokenId);
  assertPrice(priceYocto);
  state.listings.set(tokenId, { token_id: tokenId, seller_id: seller, price: priceYocto });
}

export function unlist(state: MockState, account: string, tokenId: string): void {
  assertTokenOwner(state, account, tokenId);
  state.listings.delete(tokenId);
}

/** Pays the full split (sources by stored bps, treasury), moves the token and returns the seller's proceeds. */
export function buy(state: MockState, buyer: string, tokenId: string, depositYocto: string): string {
  const listing = state.listings.get(tokenId);
  if (!listing) throw new Error("This token is not for sale");
  if (buyer === listing.seller_id) throw new Error("You already own this token");
  const price = BigInt(listing.price);
  if (!/^\d+$/.test(depositYocto) || BigInt(depositYocto) < price) throw new Error("Attach at least the listing price");

  const { royaltySourcesBps, royaltyTreasuryBps, treasuryId } = state.params;
  const toSources = creditSources(state, state.sources.get(tokenId) ?? [], bpsOf(price, royaltySourcesBps));
  const toTreasury = bpsOf(price, royaltyTreasuryBps) + bpsOf(price, royaltySourcesBps) - toSources;
  credit(state, treasuryId, toTreasury);

  state.listings.delete(tokenId);
  const token = state.tokens.get(tokenId);
  if (token) state.tokens.set(tokenId, { ...token, owner_id: buyer });
  return (price - toSources - toTreasury).toString();
}
