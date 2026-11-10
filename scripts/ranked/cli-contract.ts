// LivesContract over near-cli-rs, signing with keys in ~/.near-credentials/testnet. For scripts (genesis, demo), not the app.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Category } from "../../chain/ids.ts";
import type { Draw, LifeView, LivesContract, MintResult, SignedEvidence } from "../../client/chain/types.ts";

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
  return {
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
      const { mint_fee: fee } = await viewMethod<{ mint_fee: string }>(contractId, "get_params", {});
      const before = await viewMethod<{ token_id: string }[]>(contractId, "nft_tokens_for_owner", { account_id: accountId });
      try {
        await callMethod(accountId, contractId, "mint_life",
          { life_id: lifeId, evidence_json: signed.evidence_json, signature: signed.signature, npc_action_id: npcActionId }, `${fee} yoctoNEAR`, "200.0 Tgas");
      } catch (error) {
        if (!(error instanceof UnconfirmedTransactionError)) throw error; // the token read below settles it
      }
      const after = await viewMethod<{ token_id: string; metadata: { extra: string } }[]>(contractId, "nft_tokens_for_owner", { account_id: accountId });
      const token = after.find(t => !before.some(b => b.token_id === t.token_id));
      if (!token) throw new Error("mint_life succeeded but no new token was found.");
      const extra = JSON.parse(token.metadata.extra) as Omit<MintResult, "token_id">;
      return { token_id: token.token_id, kind: extra.kind, figure_id: extra.figure_id, rarity: extra.rarity, affection: extra.affection };
    },
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
