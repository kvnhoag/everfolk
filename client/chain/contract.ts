import { sha256Hex } from "../../chain/hash.ts";
import type { Category } from "../../chain/ids.ts";
import type { ChainConfig } from "./config.ts";
import { viewFunction, type FetchLike } from "./rpc.ts";
import type { CallAccess, ContractCall, LivesContract, MintResult, SignedEvidence, WalletSession } from "./types.ts";
import {
  assertAccountId, assertCategory, assertCommandsHash, assertLifeId, assertPrice, assertStep, assertTokenId,
} from "./validate.ts";
import {
  parseDraw, parseLife, parseListing, parseMintFee, parseMintResult, parseOptionalLife, parseStringList,
  parseTokenStats, parseTokenView, parseYocto, parseMintPack, parseMintTerms, parseMarketTerms, parsePoolEntries, parseFigureSupply, parseStageMintQuote, parseStageMintResult,
} from "./wire.ts";

const TGAS = 10n ** 12n;
const gas = (tgas: bigint) => (tgas * TGAS).toString();

/** Gas per method. Draws need 100 Tgas; mint requests/retries need 200 Tgas including their resolver. */
export const CALL_GAS = {
  start_life: gas(50n),
  abandon_life: gas(30n),
  draw_npc: gas(100n),
  checkpoint: gas(30n),
  mint_life: gas(200n),
  mint_stage_figures: gas(300n),
  retry_stage_mint: gas(300n),
  open_mint_pack: gas(250n),
  choose_mint_slot: gas(250n),
  retry_mint: gas(200n),
  set_action: gas(50n),
  withdraw: gas(30n),
  list: gas(30n),
  unlist: gas(30n),
  buy: gas(100n),
} as const;

/** Methods the sign-in function-call key may call without a popup. Gas-only, no deposit. */
export const ACCESS_KEY_METHODS = ["start_life", "abandon_life", "draw_npc", "checkpoint"] as const;

/** `list` must carry exactly 1 yoctoNEAR so only a full-access (wallet) signature can list a token. */
const ONE_YOCTO = "1";
const PAGE = 100;

type Method = keyof typeof CALL_GAS;
function assertSlot(slot: number) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 4) throw new Error("Choose one of the available mint slots (1 to 5).");
}

function accessFor(method: Method, deposit: string): CallAccess {
  return deposit === "0" && (ACCESS_KEY_METHODS as readonly string[]).includes(method) ? "function-call-key" : "wallet";
}

export interface ContractDeps {
  /** Injected for tests; defaults to the global `fetch`. */
  fetch?: FetchLike;
}

async function assertEvidenceFor(lifeId: string, signed: SignedEvidence): Promise<void> {
  if (signed.evidence.life_id !== lifeId) throw new Error("This evidence was signed for a different life.");
  if (!/^[0-9a-f]{128}$/.test(signed.signature)) throw new Error("The evidence signature must be 128 hex characters.");
  if ((await sha256Hex(signed.evidence_json)) !== signed.evidence_hash) throw new Error("The evidence hash does not match the signed evidence.");
}

/** The lives contract over a wallet session (change calls) and JSON-RPC (views). */
export function createLivesContract(wallet: WalletSession, cfg: ChainConfig, deps: ContractDeps = {}): LivesContract {
  const fetchFn: FetchLike = deps.fetch ?? ((input, init) => globalThis.fetch(input, init));

  const call = (method: Method, args: Record<string, unknown>, deposit = "0"): Promise<unknown> => {
    const request: ContractCall = { method, args, gas: CALL_GAS[method], deposit, access: accessFor(method, deposit) };
    return wallet.call(request);
  };
  const view = (method: string, args: Record<string, unknown>) => viewFunction(fetchFn, cfg.rpcUrl, cfg.contractId, method, args);

  async function paged<T>(method: string, args: Record<string, unknown>, parse: (value: unknown) => T[]): Promise<T[]> {
    const pages: T[][] = [];
    for (let from = 0; ; from += PAGE) {
      const page = parse(await view(method, { ...args, from_index: from, limit: PAGE }));
      pages.push(page);
      if (page.length < PAGE) return pages.flat();
    }
  }

  async function mintResult(lifeId: string): Promise<MintResult | null> {
    assertLifeId(lifeId);
    const result = await view("mint_result", { life_id: lifeId });
    return result === null ? null : parseMintResult(result);
  }

  async function retryMint(lifeId: string): Promise<MintResult> {
    assertLifeId(lifeId);
    const completed = await mintResult(lifeId);
    if (completed) return completed;
    // New stage albums retain the legacy recovery entry point used by My lives.
    if (await view("stage_mint_status", { life_id: lifeId }).catch(() => null)) {
      return (await retryStageMint(lifeId)).tokens[0];
    }
    try {
      return parseMintResult(await call("retry_mint", { life_id: lifeId }));
    } catch (error) {
      // A resolver can land before the wallet/RPC reports it. A second request is never a second fee.
      const landed = await mintResult(lifeId).catch(() => null);
      if (landed) return landed;
      throw error;
    }
  }

  async function stageMintResult(lifeId: string) {
    assertLifeId(lifeId);
    const result = await view("stage_mint_result", { life_id: lifeId });
    return result === null ? null : parseStageMintResult(result);
  }
  async function retryStageMint(lifeId: string) {
    assertLifeId(lifeId);
    const completed = await stageMintResult(lifeId);
    if (completed) return completed;
    try { return parseStageMintResult(await call("retry_stage_mint", { life_id: lifeId })); }
    catch (error) {
      const landed = await stageMintResult(lifeId).catch(() => null);
      if (landed) return landed;
      throw error;
    }
  }

  return {
    async startLife(worldVersion) {
      if (!worldVersion) throw new Error("A world version is required to start a ranked life.");
      return parseLife(await call("start_life", { world_version: worldVersion }));
    },
    async abandonLife(lifeId) {
      assertLifeId(lifeId);
      await call("abandon_life", { life_id: lifeId });
    },
    async drawNpc(lifeId: string, step: number, category: Category, commandsHash: string) {
      assertLifeId(lifeId);
      assertStep(step);
      assertCategory(category);
      assertCommandsHash(commandsHash);
      return parseDraw(await call("draw_npc", { life_id: lifeId, step, category, commands_hash: commandsHash }));
    },
    async checkpoint(lifeId, step, commandsHash) {
      assertLifeId(lifeId);
      assertStep(step);
      assertCommandsHash(commandsHash);
      await call("checkpoint", { life_id: lifeId, step, commands_hash: commandsHash });
    },
    async getLife(lifeId) {
      assertLifeId(lifeId);
      return parseOptionalLife(await view("get_life", { life_id: lifeId }));
    },
    async activeLifeOf(account) {
      assertAccountId(account);
      return parseOptionalLife(await view("active_life_of", { account_id: account }));
    },
    async mintLife(lifeId, signed, npcActionId) {
      assertLifeId(lifeId);
      if (!npcActionId) throw new Error("Pick an action for the minted NPC.");
      await assertEvidenceFor(lifeId, signed);
      const life = parseOptionalLife(await view("get_life", { life_id: lifeId }));
      if (life?.status === "minting") return retryMint(lifeId);
      if (life?.status === "minted") {
        const completed = await mintResult(lifeId);
        if (completed) return completed;
        throw new Error("This life is already minted, but its result is unavailable. Open its token from the ledger.");
      }
      const fee = parseMintFee(await view("get_params", {}));
      const args = { life_id: lifeId, evidence_json: signed.evidence_json, signature: signed.signature, npc_action_id: npcActionId };
      try {
        return parseMintResult(await call("mint_life", args, fee));
      } catch (error) {
        const landed = await mintResult(lifeId).catch(() => null);
        if (landed) return landed;
        throw error;
      }
    },
    retryMint,
    mintResult,
    stageMintResult,
    retryStageMint,
    async stageMintQuote(lifeId, signed, npcActionId) {
      assertLifeId(lifeId); await assertEvidenceFor(lifeId, signed);
      return parseStageMintQuote(await view("stage_mint_quote", { life_id: lifeId, evidence_json: signed.evidence_json, npc_action_id: npcActionId }));
    },
    async mintStageFigures(lifeId, signed, npcActionId, expectedFee) {
      assertLifeId(lifeId); await assertEvidenceFor(lifeId, signed);
      const completed = await stageMintResult(lifeId);
      if (completed) return completed;
      const life = parseOptionalLife(await view("get_life", { life_id: lifeId }));
      if (life?.status === "minting") return retryStageMint(lifeId);
      const quote = parseStageMintQuote(await view("stage_mint_quote", { life_id: lifeId, evidence_json: signed.evidence_json, npc_action_id: npcActionId }));
      if (expectedFee !== undefined && quote.total_fee !== expectedFee) throw new Error("Stage prices changed as historical supply changed. Refresh prices before paying.");
      try {
        return parseStageMintResult(await call("mint_stage_figures", { life_id: lifeId, evidence_json: signed.evidence_json, signature: signed.signature, npc_action_id: npcActionId }, quote.total_fee));
      } catch (error) {
        const landed = await stageMintResult(lifeId).catch(() => null);
        if (landed) return landed;
        throw error;
      }
    },
    async setAction(tokenId, actionId) {
      assertTokenId(tokenId);
      if (!actionId) throw new Error("An action id is required.");
      await call("set_action", { token_id: tokenId, action_id: actionId });
    },
    async mintTerms() { return parseMintTerms(await view("mint_terms", {})); },
    async marketTerms() { return parseMarketTerms(await view("get_params", {})); },
    async mintPack(lifeId) {
      assertLifeId(lifeId);
      const value = await view("get_mint_pack", { life_id: lifeId });
      return value === null ? null : parseMintPack(value);
    },
    async openMintPack(lifeId, signed, npcActionId) {
      assertLifeId(lifeId);
      await assertEvidenceFor(lifeId, signed);
      if (!npcActionId) throw new Error("Choose your life's deed first.");
      // Opening is free; the fee it quotes is paid when a card is minted.
      return parseMintPack(await call("open_mint_pack", { life_id: lifeId, evidence_json: signed.evidence_json, signature: signed.signature, npc_action_id: npcActionId }));
    },
    async chooseMintSlot(lifeId, slot) {
      assertLifeId(lifeId); assertSlot(slot);
      const pack = await view("get_mint_pack", { life_id: lifeId });
      if (pack === null) throw new Error("Open this life's pack first.");
      const fee = parseMintPack(pack).total_fee;
      assertPrice(fee);
      return parseMintResult(await call("choose_mint_slot", { life_id: lifeId, slot }, fee));
    },
    async figureCopies(figureId) { return parsePoolEntries(await view("figure_copies", { figure_id: figureId })); },
    async figureSupply(figureId) { return parseFigureSupply(await view("figure_supply", { figure_id: figureId })); },
    async withdraw() {
      await call("withdraw", {});
    },
    async balanceOf(account) {
      assertAccountId(account);
      return parseYocto(await view("balance_of", { account_id: account }), "balance");
    },
    async token(tokenId) {
      assertTokenId(tokenId);
      return parseTokenView(await view("nft_token", { token_id: tokenId }));
    },
    async tokensOf(owner) {
      assertAccountId(owner);
      const tokens: Awaited<ReturnType<LivesContract["tokensOf"]>> = [];
      // NEP-181 offsets are U128 decimal strings, unlike this contract's numeric pagination offsets.
      for (let from = 0n; ; from += BigInt(PAGE)) {
        const page = await view("nft_tokens_for_owner", { account_id: owner, from_index: from.toString(), limit: PAGE });
        if (!Array.isArray(page)) throw new Error("The contract returned an unexpected token list.");
        tokens.push(...page.map(token => ({ token_id: String((token as { token_id: unknown }).token_id), ...parseTokenView(token)! })));
        if (page.length < PAGE) return tokens;
      }
    },
    async tokenStats(tokenId) {
      assertTokenId(tokenId);
      return parseTokenStats(await view("token_stats", { token_id: tokenId }));
    },
    async childrenOf(tokenId) {
      assertTokenId(tokenId);
      return paged("children_of", { token_id: tokenId }, value => parseStringList(value, "children list"));
    },
    async list(tokenId, priceYocto) {
      assertTokenId(tokenId);
      assertPrice(priceYocto);
      await call("list", { token_id: tokenId, price: priceYocto }, ONE_YOCTO);
    },
    async unlist(tokenId) {
      assertTokenId(tokenId);
      await call("unlist", { token_id: tokenId });
    },
    async buy(tokenId, priceYocto) {
      assertTokenId(tokenId);
      assertPrice(priceYocto);
      return parseYocto(await call("buy", { token_id: tokenId }, priceYocto), "sale proceeds");
    },
    async listings() {
      return paged("listings", {}, value => {
        if (!Array.isArray(value)) throw new Error("The contract returned an unexpected listings page.");
        return value.map(parseListing);
      });
    },
  };
}
