import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import type { ChainConfig } from "./config.ts";
import { ACCESS_KEY_METHODS } from "./contract.ts";
import { contractErrorMessage, hasFinalStatus, readCallResult, transactionHash } from "./outcome.ts";
import type { ContractCall, WalletSession } from "./types.ts";
import { hostInTopLayer } from "./wallet-host.ts";

/**
 * The only module that touches NEAR wallet libraries (@near-wallet-selector 10.x). They load lazily, in the
 * browser only, so the worker/SSR bundles and Node tests never import them.
 *
 * Sign-in asks the wallet for a function-call access key limited to `ACCESS_KEY_METHODS` on the contract.
 * The wallet module then signs zero-deposit calls to those methods with that local key (no popup) and
 * opens the wallet for anything else — every deposit, including `list`'s 1 yoctoNEAR.
 */

const TX_POLL_ATTEMPTS = 20;
const TX_POLL_DELAY_MS = 1500;

interface Loaded { selector: WalletSelector; modal: WalletSelectorModal }

function activeAccount(selector: WalletSelector): string | null {
  const accounts = selector.store.getState().accounts;
  return accounts.find(account => account.active)?.accountId ?? accounts[0]?.accountId ?? null;
}

/** near-js and the wallet modules call a Node-style global `Buffer` (args encoding, popup URLs); browsers lack it. */
async function ensureBufferGlobal(): Promise<void> {
  const scope = globalThis as typeof globalThis & { Buffer?: unknown };
  if (scope.Buffer) return;
  const { Buffer } = await import("buffer");
  scope.Buffer = Buffer;
}

async function loadSelector(cfg: ChainConfig): Promise<Loaded> {
  if (typeof window === "undefined") throw new Error("The NEAR wallet is only available in the browser.");
  await ensureBufferGlobal();
  const [{ setupWalletSelector }, { setupModal }, { setupMyNearWallet }, { setupMeteorWallet }] = await Promise.all([
    import("@near-wallet-selector/core"),
    import("@near-wallet-selector/modal-ui"),
    import("@near-wallet-selector/my-near-wallet"),
    import("@near-wallet-selector/meteor-wallet"),
    import("@near-wallet-selector/modal-ui/styles.css"),
  ]);
  const access = { contractId: cfg.contractId, methodNames: [...ACCESS_KEY_METHODS] };
  const selector = await setupWalletSelector({
    network: cfg.networkId,
    fallbackRpcUrls: [cfg.rpcUrl],
    modules: [setupMeteorWallet(), setupMyNearWallet({ walletUrl: "https://testnet.mynearwallet.com" })],
    createAccessKeyFor: access,
  });
  // The modal forwards its own contractId/methodNames to `wallet.signIn`, overriding `createAccessKeyFor`; pass both.
  const modal = setupModal(selector, { ...access, theme: "auto", description: "Connect a NEAR testnet wallet to live a ranked life." });
  return { selector, modal };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Browser wallets may return before execution finishes; poll the RPC until the outcome is final. */
async function finalOutcome(outcome: unknown, cfg: ChainConfig, signerId: string): Promise<unknown> {
  if (hasFinalStatus(outcome)) return outcome;
  const hash = transactionHash(outcome);
  if (!hash) throw new Error("The wallet did not return a transaction to follow.");
  for (let attempt = 0; attempt < TX_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(cfg.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "everfolk", method: "tx", params: { tx_hash: hash, sender_account_id: signerId, wait_until: "EXECUTED_OPTIMISTIC" } }),
    }).catch(() => null);
    const payload: unknown = response?.ok ? await response.json().catch(() => null) : null;
    const result = typeof payload === "object" && payload !== null ? (payload as { result?: unknown }).result : undefined;
    if (hasFinalStatus(result)) return result;
    await sleep(TX_POLL_DELAY_MS);
  }
  throw new Error(`Transaction ${hash} has not finished yet. Check it on the explorer and retry.`);
}

function waitForSignIn(selector: WalletSelector, modal: WalletSelectorModal): Promise<void> {
  return new Promise((resolve, reject) => {
    const signedIn = selector.on("signedIn", () => {
      cleanup();
      resolve();
    });
    const hidden = modal.on("onHide", ({ hideReason }) => {
      if (hideReason !== "user-triggered" || activeAccount(selector)) return;
      cleanup();
      reject(new Error("Wallet connection was cancelled."));
    });
    let restore = () => {};
    const cleanup = () => {
      signedIn.remove();
      hidden.remove();
      restore();
    };
    modal.show();
    // The picker renders on the next frame; then lift it into the open ranked dialog so it is visible and clickable.
    requestAnimationFrame(() => { restore = hostInTopLayer(); });
  });
}

/** wallet-selector remembers the chosen wallet under this key; its presence means a session can be restored. */
export const REMEMBERED_WALLET_KEY = "near-wallet-selector:selectedWalletId";

/** Connects to the wallet selector for `cfg`. Resolves already signed in when a previous session exists. */
export async function createWalletSession(cfg: ChainConfig): Promise<WalletSession> {
  const { selector, modal } = await loadSelector(cfg);
  const listeners = new Set<(hash: string, method: string) => void>();
  return {
    get accountId() {
      return activeAccount(selector);
    },
    get walletId() {
      return selector.store.getState().selectedWalletId ?? null;
    },
    onTransaction(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async signIn() {
      if (activeAccount(selector)) return;
      await waitForSignIn(selector, modal);
    },
    async signOut() {
      if (!selector.isSignedIn()) return;
      await (await selector.wallet()).signOut();
    },
    async call(call: ContractCall) {
      const signerId = activeAccount(selector);
      if (!signerId) throw new Error("Connect a NEAR wallet first.");
      const { actionCreators } = await import("@near-wallet-selector/core");
      const wallet = await selector.wallet();
      const action = actionCreators.functionCall(call.method, call.args, BigInt(call.gas), BigInt(call.deposit));
      try {
        const outcome = await finalOutcome(await wallet.signAndSendTransaction({ signerId, receiverId: cfg.contractId, actions: [action] }), cfg, signerId);
        const hash = transactionHash(outcome);
        if (hash) for (const listener of listeners) listener(hash, call.method);
        return readCallResult(outcome);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${call.method} failed: ${contractErrorMessage(message)}`);
      }
    },
  };
}
