// LivesContract over near-cli-rs, signing with keys in ~/.near-credentials/testnet. For scripts (genesis, demo), not the app.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Category } from "../../chain/ids.ts";
import type { EditionSupply } from "../../chain/types.ts";
import { parseEditionSupply, parseMintResult } from "../../client/chain/wire.ts";
import type { Draw, LifeView, LivesContract, MintResult, StageMintQuote, StageMintResult, SignedEvidence } from "../../client/chain/types.ts";

const run = promisify(execFile);
const NEAR_CLI = ["-y", "near-cli-rs@0.31.1"];
const NETWORK = ["network-config", "testnet"];

const RATE_LIMITED = /rate limit|429|too many requests/i;
/** near-cli-rs prints the transaction id once it has sent the transaction; failures after that are not safe to retry. */
const SENT = /Transaction ID:|Transaction Execution Info/i;
const MAX_ATTEMPTS = 6;

/** Sent but its outcome unknown (for example the status poll was rate-limited). Callers must check the chain. */
export class UnconfirmedTransactionError extends Error {}

/** Retries rate-limited calls only while nothing has been sent, so a retry can never send a transaction twice. */
async function cli(args: string[]): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const { stdout } = await run("npx", [...NEAR_CLI, ...args], { maxBuffer: 64 * 1024 * 1024 });
      return stdout;
    } catch (error) {
      const output = `${(error as { stdout?: string }).stdout ?? ""}${(error as { stderr?: string }).stderr ?? ""}`;
      const text = `${output}${(error as Error).message}`;
      if (SENT.test(output)) throw new UnconfirmedTransactionError(`Sent, but the outcome could not be read: ${(error as Error).message.slice(0, 200)}`);
      if (attempt >= MAX_ATTEMPTS || !RATE_LIMITED.test(text)) throw error;
      await new Promise(resolve => setTimeout(resolve, 2_000 * 2 ** attempt));
    }
  }
}

/** near-cli-rs prints the JSON return value on stdout, sometimes after a banner line. */
function jsonFrom(stdout: string): unknown {
  const start = stdout.search(/^\s*(\{|\[|null|true|false|"|-?\d)/m);
  if (start < 0) throw new Error(`No JSON in near-cli output: ${stdout.slice(0, 200)}`);
  return JSON.parse(stdout.slice(start).trim());
}

export async function viewMethod<T>(contractId: string, method: string, args: unknown): Promise<T> {
  return jsonFrom(await cli(["contract", "call-function", "as-read-only", contractId, method, "json-args", JSON.stringify(args), ...NETWORK, "now"])) as T;
}

export async function callMethod(signer: string, contractId: string, method: string, args: unknown, deposit = "0 NEAR", gas = "300.0 Tgas"): Promise<void> {
  await cli(["contract", "call-function", "as-transaction", contractId, method, "json-args", JSON.stringify(args), "prepaid-gas", gas,
    "attached-deposit", deposit, "sign-as", signer, ...NETWORK, "sign-with-legacy-keychain", "send"]);
}

export async function createFaucetAccount(accountId: string): Promise<void> {
  await cli(["account", "create-account", "sponsor-by-faucet-service", accountId, "autogenerate-new-keypair", "save-to-legacy-keychain", ...NETWORK, "create"]);
}

/** The subset of LivesContract a ranked session and minting need, acting as `accountId`. */
export function createCliContract(contractId: string, accountId: string): LivesContract {
  const unsupported = (name: string) => () => Promise.reject(new Error(`${name} is not available in the CLI contract.`));
  const mintResult = (lifeId: string) => viewMethod<MintResult | null>(contractId, "mint_result", { life_id: lifeId });
  const retryMint = async (lifeId: string): Promise<MintResult> => {
    const completed = await mintResult(lifeId);
    if (completed) return completed;
    if (await viewMethod(contractId, "stage_mint_status", { life_id: lifeId }).catch(() => null)) return (await retryStageMint(lifeId)).tokens[0];
    try {
      await callMethod(accountId, contractId, "retry_mint", { life_id: lifeId }, "0 NEAR", "200.0 Tgas");
    } catch (error) {
      if (!(error instanceof UnconfirmedTransactionError)) throw error;
    }
    const result = await mintResult(lifeId);
    if (!result) throw new Error("The committed mint is not complete yet; retry it without another mint fee.");
    return result;
  };
  const stageMintResult = (lifeId: string) => viewMethod<StageMintResult | null>(contractId, "stage_mint_result", { life_id: lifeId });
  const retryStageMint = async (lifeId: string): Promise<StageMintResult> => {
    const completed = await stageMintResult(lifeId); if (completed) return completed;
    try { await callMethod(accountId, contractId, "retry_stage_mint", { life_id: lifeId }); }
    catch (error) { if (!(error instanceof UnconfirmedTransactionError)) throw error; }
    const result = await stageMintResult(lifeId);
    if (!result) throw new Error("The stage album is committed; retry it without another mint fee.");
    return result;
  };
  return {
    stageMintResult,
    retryStageMint,
    stageMintQuote: (lifeId, signed, action) => viewMethod<StageMintQuote>(contractId, "stage_mint_quote", { life_id: lifeId, evidence_json: signed.evidence_json, npc_action_id: action }),
    async mintStageFigures(lifeId, signed, action, expectedFee, expectedQuoteHash) {
      const completed = await stageMintResult(lifeId); if (completed) return completed;
      const life = await viewMethod<LifeView | null>(contractId, "get_life", { life_id: lifeId });
      if (life?.status === "minting") return retryStageMint(lifeId);
      const args = { life_id: lifeId, evidence_json: signed.evidence_json, npc_action_id: action };
      const quote = await viewMethod<StageMintQuote>(contractId, "stage_mint_quote", args);
      if (expectedFee !== undefined && expectedFee !== quote.total_fee) throw new Error("Stage prices changed. Refresh before paying.");
      if (expectedQuoteHash !== undefined && expectedQuoteHash !== quote.quote_hash) throw new Error("Stage cards changed. Refresh before paying.");
      const quoteHash = expectedQuoteHash ?? quote.quote_hash;
      try { await callMethod(accountId, contractId, "mint_stage_figures", { ...args, signature: signed.signature, ...(quoteHash ? { expected_quote_hash: quoteHash } : {}) }, `${quote.total_fee} yoctoNEAR`); }
      catch (error) { if (!(error instanceof UnconfirmedTransactionError)) throw error; }
      const result = await stageMintResult(lifeId);
      if (!result) throw new Error("The stage album is committed; retry it without another mint fee.");
      return result;
    },
    mintTerms: () => viewMethod(contractId, "mint_terms", {}),
    marketTerms: unsupported("marketTerms"),
    mintPack: lifeId => viewMethod(contractId, "get_mint_pack", { life_id: lifeId }),
    async openMintPack(lifeId, signed, action) {
      // Opening is free; the quoted fee is paid when a card is minted (mint_terms pack_version 2).
      await callMethod(accountId, contractId, "open_mint_pack", { life_id: lifeId, evidence_json: signed.evidence_json, signature: signed.signature, npc_action_id: action }, "0 NEAR");
      return viewMethod(contractId, "get_mint_pack", { life_id: lifeId });
    },
    async chooseMintSlot(lifeId, slot) {
      const pack = await viewMethod<{ total_fee: string } | null>(contractId, "get_mint_pack", { life_id: lifeId });
      if (!pack) throw new Error("Open this life's pack first.");
      await callMethod(accountId, contractId, "choose_mint_slot", { life_id: lifeId, slot }, `${pack.total_fee} yoctoNEAR`);
      const completed = await mintResult(lifeId);
      if (completed) return completed;
      const tokens = await viewMethod<{ token_id: string; metadata: { extra: string } }[]>(contractId, "nft_tokens_for_owner", { account_id: accountId });
      const token = tokens.find(t => JSON.parse(t.metadata.extra).life_id === lifeId);
      if (!token) throw new Error("The selected card's token could not be found.");
      const extra = JSON.parse(token.metadata.extra) as Omit<MintResult, "token_id">;
      return parseMintResult({ token_id: token.token_id, ...extra });
    },
    figureCopies: figureId => viewMethod(contractId, "figure_copies", { figure_id: figureId }),
    figureSupply: figureId => viewMethod(contractId, "figure_supply", { figure_id: figureId }),
    editionSupply: async (editionKey, rarity) => parseEditionSupply(await viewMethod<EditionSupply>(contractId, "edition_supply", { edition_key: editionKey, rarity })),
    async startLife(worldVersion) {
      try {
        await callMethod(accountId, contractId, "start_life", { world_version: worldVersion }, "0 NEAR", "50.0 Tgas");
      } catch (error) {
        if (!(error instanceof UnconfirmedTransactionError)) throw error; // the active-life read below settles it
      }
      const life = await viewMethod<LifeView | null>(contractId, "active_life_of", { account_id: accountId });
      if (!life) throw new Error("start_life succeeded but no active life was found.");
      return life;
    },
    async abandonLife(lifeId) { await callMethod(accountId, contractId, "abandon_life", { life_id: lifeId }); },
    async drawNpc(lifeId: string, step: number, category: Category, commandsHash: string): Promise<Draw> {
      await callMethod(accountId, contractId, "draw_npc", { life_id: lifeId, step, category, commands_hash: commandsHash }, "0 NEAR", "150.0 Tgas");
      const life = await viewMethod<LifeView>(contractId, "get_life", { life_id: lifeId });
      const draw = life.draws.find(d => d.step === step);
      if (!draw) throw new Error(`draw_npc at step ${step} left no draw on chain.`);
      return draw;
    },
    async checkpoint(lifeId, step, commandsHash) {
      await callMethod(accountId, contractId, "checkpoint", { life_id: lifeId, step, commands_hash: commandsHash }, "0 NEAR", "50.0 Tgas");
    },
    getLife: lifeId => viewMethod<LifeView | null>(contractId, "get_life", { life_id: lifeId }),
    activeLifeOf: account => viewMethod<LifeView | null>(contractId, "active_life_of", { account_id: account }),
    async mintLife(lifeId: string, signed: SignedEvidence, npcActionId: string): Promise<MintResult> {
      const life = await viewMethod<LifeView | null>(contractId, "get_life", { life_id: lifeId });
      if (life?.status === "minting") return retryMint(lifeId);
      const completed = await mintResult(lifeId);
      if (completed) return completed;
      const { mint_fee: fee } = await viewMethod<{ mint_fee: string }>(contractId, "get_params", {});
      try {
        await callMethod(accountId, contractId, "mint_life",
          { life_id: lifeId, evidence_json: signed.evidence_json, signature: signed.signature, npc_action_id: npcActionId }, `${fee} yoctoNEAR`, "200.0 Tgas");
      } catch (error) {
        if (!(error instanceof UnconfirmedTransactionError)) throw error; // the token read below settles it
      }
      const result = await mintResult(lifeId);
      if (!result) throw new Error("The mint is committed but its result is not available yet; retry without another mint fee.");
      return result;
    },
    retryMint,
    mintResult,
    async setAction(tokenId, actionId) { await callMethod(accountId, contractId, "set_action", { token_id: tokenId, action_id: actionId }); },
    async withdraw() { await callMethod(accountId, contractId, "withdraw", {}); },
    balanceOf: async account => (await viewMethod<string>(contractId, "balance_of", { account_id: account })),
    token: unsupported("token"),
    async tokensOf(owner) {
      const tokens = await viewMethod<{ token_id: string; owner_id: string; metadata: { extra: string } }[]>(contractId, "nft_tokens_for_owner", { account_id: owner });
      return tokens.map(t => ({ token_id: t.token_id, owner_id: t.owner_id, extra: JSON.parse(t.metadata.extra) }));
    },
    tokenStats: tokenId => viewMethod(contractId, "token_stats", { token_id: tokenId }),
    childrenOf: tokenId => viewMethod(contractId, "children_of", { token_id: tokenId, from_index: 0, limit: 100 }),
    async list(tokenId, priceYocto) { await callMethod(accountId, contractId, "list", { token_id: tokenId, price: priceYocto }, "1 yoctoNEAR"); },
    async unlist(tokenId) { await callMethod(accountId, contractId, "unlist", { token_id: tokenId }); },
    buy: unsupported("buy"),
    listings: () => viewMethod(contractId, "listings", { from_index: 0, limit: 100 }),
  };
}
