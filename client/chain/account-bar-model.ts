import { formatNear } from "./near-amount.ts";
import type { SignInMethod } from "./session-router.ts";

const EXPLORER = "https://testnet.nearblocks.io";
const WALLET_NAMES: Record<string, string> = { "my-near-wallet": "MyNearWallet", "meteor-wallet": "Meteor Wallet" };

export interface AccountBarInput {
  mode: "live" | "preview";
  accountId: string | null;
  walletId?: string | null;
  balanceYocto?: string | null;
  claimableYocto?: string | null;
  method?: SignInMethod | null;
  email?: string | null;
}

export type AccountBarView =
  | { status: "practice"; note: string }
  | { status: "disconnected"; network: "Testnet"; account: null }
  | {
    status: "connected"; network: "Testnet"; account: string; wallet: string | null; claimable: string | null; accountUrl: string;
    /** How the player is named: their email, "Your Everfolk account", or the NEAR account id. */
    label: string;
    /** Spendable NEAR; null for email players, who only see NEAR on the spend sheet. */
    balance: string | null;
    method: SignInMethod | null;
  };

const IMPLICIT_ACCOUNT = /^[0-9a-f]{64}$/;
const SHORT_EDGE = 6;
export const EMAIL_ACCOUNT_LABEL = "Your Everfolk account";

/** Implicit + email -> the email; implicit email account without one -> "Your Everfolk account"; named -> the id. */
export function accountLabel(accountId: string, method: SignInMethod | null, email: string | null): string {
  if (!IMPLICIT_ACCOUNT.test(accountId)) return accountId;
  if (email) return email;
  // A NEAR wallet can also hold an implicit account; it is the player's own id, shortened, not an Everfolk account.
  return method === "wallet" ? `${accountId.slice(0, SHORT_EDGE)}…${accountId.slice(-SHORT_EDGE)}` : EMAIL_ACCOUNT_LABEL;
}

export function explorerUrl(target: { account: string } | { tx: string }): string {
  return "account" in target ? `${EXPLORER}/address/${encodeURIComponent(target.account)}` : `${EXPLORER}/txns/${encodeURIComponent(target.tx)}`;
}

export function walletLabel(walletId: string | null | undefined): string | null {
  if (!walletId) return null;
  return WALLET_NAMES[walletId] ?? walletId;
}

/** The strip at the top of the ranked screens: who is connected, on which network, and what they hold. */
export function accountBarView(input: AccountBarInput): AccountBarView {
  if (input.mode === "preview") return { status: "practice", note: "Practice ledger: lives, coins and sales here are not recorded on NEAR." };
  if (!input.accountId) return { status: "disconnected", network: "Testnet", account: null };
  const email = input.method === "email";
  const owed = input.claimableYocto && BigInt(input.claimableYocto) > 0n ? input.claimableYocto : null;
  const claimable = owed ? (email ? "Earnings" : `${formatNear(owed)} NEAR`) : null;
  return {
    status: "connected", network: "Testnet", account: input.accountId, wallet: email ? null : walletLabel(input.walletId),
    balance: email ? null : input.balanceYocto ? `${formatNear(input.balanceYocto)} NEAR` : "…", claimable,
    accountUrl: explorerUrl({ account: input.accountId }),
    label: accountLabel(input.accountId, input.method ?? null, input.email ?? null), method: input.method ?? null,
  };
}
