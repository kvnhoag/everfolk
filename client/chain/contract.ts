import { sha256Hex } from "../../chain/hash.ts";
import type { Category } from "../../chain/ids.ts";
import type { ChainConfig } from "./config.ts";
import { viewFunction, type FetchLike } from "./rpc.ts";
import type { CallAccess, ContractCall, LivesContract, SignedEvidence, WalletSession } from "./types.ts";
import {
  assertAccountId, assertCategory, assertCommandsHash, assertLifeId, assertPrice, assertStep, assertTokenId,
} from "./validate.ts";
import {
  parseDraw, parseLife, parseListing, parseMintFee, parseMintResult, parseOptionalLife, parseStringList,
  parseTokenStats, parseTokenView, parseYocto,
} from "./wire.ts";

const TGAS = 10n ** 12n;
const gas = (tgas: bigint) => (tgas * TGAS).toString();

/** Gas per method. `draw_npc` and `mint_life` must meet the contract's floors (100 / 150 Tgas). */
export const CALL_GAS = {
  start_life: gas(50n),
  abandon_life: gas(30n),
  draw_npc: gas(100n),
  checkpoint: gas(30n),
  mint_life: gas(200n),
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
      const fee = parseMintFee(await view("get_params", {}));
      const args = { life_id: lifeId, evidence_json: signed.evidence_json, signature: signed.signature, npc_action_id: npcActionId };
      return parseMintResult(await call("mint_life", args, fee));
    },
    async setAction(tokenId, actionId) {
      assertTokenId(tokenId);
      if (!actionId) throw new Error("An action id is required.");
      await call("set_action", { token_id: tokenId, action_id: actionId });
    },
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
      const tokens = await view("nft_tokens_for_owner", { account_id: owner, from_index: "0", limit: 100 });
      if (!Array.isArray(tokens)) throw new Error("The contract returned an unexpected token list.");
      return tokens.map(token => ({ token_id: String((token as { token_id: unknown }).token_id), ...parseTokenView(token)! }));
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
