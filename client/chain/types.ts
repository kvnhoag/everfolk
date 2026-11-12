import type { Category } from "../../chain/ids.ts";
import type { Draw, Evidence, LifeView, Listing, MintResult, MintPack, MintTerms, PoolEntry, TokenExtra, TokenStats } from "../../chain/types.ts";

export type { Draw, Evidence, LifeView, Listing, MintResult, MintPack, MintCard, MintTerms, TokenExtra, TokenStats } from "../../chain/types.ts";

/**
 * What the verifier returns for a finished life. Local stand-in until lane E publishes it from
 * `server/ranked/verifier.ts`; the field set must stay identical.
 */
export interface SignedEvidence {
  evidence: Evidence;
  evidence_json: string;
  evidence_hash: string;
  signature: string;
  verifier_kind: "server-signer" | "tee";
}

/** Sale royalties in basis points, from the contract's params. */
export interface MarketTerms { royaltySourcesBps: number; royaltyTreasuryBps: number }

export interface TokenView { owner_id: string; extra: TokenExtra }

/** Every lives-contract call the client makes. Ids and yocto amounts are decimal strings, as on the wire. */
export interface LivesContract {
  startLife(worldVersion: string): Promise<LifeView>;
  abandonLife(lifeId: string): Promise<void>;
  /** Retrying the same `step` with the same hash returns the stored draw (idempotent on chain). */
  drawNpc(lifeId: string, step: number, category: Category, commandsHash: string): Promise<Draw>;
  checkpoint(lifeId: string, step: number, commandsHash: string): Promise<void>;
  getLife(lifeId: string): Promise<LifeView | null>;
  activeLifeOf(account: string): Promise<LifeView | null>;
  mintLife(lifeId: string, signed: SignedEvidence, npcActionId: string): Promise<MintResult>;
  mintTerms(): Promise<MintTerms>;
  marketTerms(): Promise<MarketTerms>;
  mintPack(lifeId: string): Promise<MintPack | null>;
  openMintPack(lifeId: string, signed: SignedEvidence, npcActionId: string): Promise<MintPack>;
  rerollMintSlot(lifeId: string, slot: number, feeYocto: string): Promise<MintPack>;
  chooseMintSlot(lifeId: string, slot: number): Promise<MintResult>;
  figureCopies(figureId: string): Promise<PoolEntry[]>;
  figureSupply(figureId: string): Promise<[number, number]>;
  /** Completes an already committed mint without paying its fee again. */
  retryMint(lifeId: string): Promise<MintResult>;
  /** Immutable result keyed by life, independent of the token's current owner. */
  mintResult(lifeId: string): Promise<MintResult | null>;
  setAction(tokenId: string, actionId: string): Promise<void>;
  withdraw(): Promise<void>;
  balanceOf(account: string): Promise<string>;
  token(tokenId: string): Promise<TokenView | null>;
  /** Tokens owned by `account` (NEP-181), newest last. */
  tokensOf(account: string): Promise<(TokenView & { token_id: string })[]>;
  tokenStats(tokenId: string): Promise<TokenStats>;
  childrenOf(tokenId: string): Promise<string[]>;
  list(tokenId: string, priceYocto: string): Promise<void>;
  unlist(tokenId: string): Promise<void>;
  /** Pays `priceYocto` and resolves to the seller's proceeds in yoctoNEAR. */
  buy(tokenId: string, priceYocto: string): Promise<string>;
  listings(): Promise<Listing[]>;
}

/**
 * How a call is signed. `function-call-key` calls are gas-only and limited to the methods the
 * sign-in key allows (no popup); everything else, and every call with a deposit, opens the wallet.
 */
export type CallAccess = "function-call-key" | "wallet";

/** One change call to the lives contract. `gas` and `deposit` are decimal strings (gas units, yoctoNEAR). */
export interface ContractCall {
  method: string;
  args: Record<string, unknown>;
  gas: string;
  deposit: string;
  access: CallAccess;
}

/** The signed-in NEAR account and the only path for change calls. `call` resolves to the method's decoded JSON return value. */
export interface WalletSession {
  readonly accountId: string | null;
  /** Wallet module id, e.g. "meteor-wallet"; null when not signed in or unknown. */
  readonly walletId?: string | null;
  /** True when signed in without a usable play key, so ranked moves would open the wallet; `signIn()` re-keys. */
  readonly needsPlayKey?: boolean;
  /** Called with each confirmed transaction hash, for explorer links in the UI. Returns an unsubscribe. */
  onTransaction?(listener: (hash: string, method: string) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  call(call: ContractCall): Promise<unknown>;
}
