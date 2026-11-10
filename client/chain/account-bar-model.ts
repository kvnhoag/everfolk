import { formatNear } from "./near-amount.ts";

const EXPLORER = "https://testnet.nearblocks.io";
const WALLET_NAMES: Record<string, string> = { "my-near-wallet": "MyNearWallet", "meteor-wallet": "Meteor Wallet" };

export interface AccountBarInput {
  mode: "live" | "preview";
  accountId: string | null;
  walletId?: string | null;
  balanceYocto?: string | null;
  claimableYocto?: string | null;
}

export type AccountBarView =
  | { status: "practice"; note: string }
  | { status: "disconnected"; network: "Testnet"; account: null }
  | { status: "connected"; network: "Testnet"; account: string; wallet: string | null; balance: string; claimable: string | null; accountUrl: string };

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
  const claimable = input.claimableYocto && BigInt(input.claimableYocto) > 0n ? `${formatNear(input.claimableYocto)} NEAR` : null;
  return {
    status: "connected", network: "Testnet", account: input.accountId, wallet: walletLabel(input.walletId),
    balance: input.balanceYocto ? `${formatNear(input.balanceYocto)} NEAR` : "…", claimable,
    accountUrl: explorerUrl({ account: input.accountId }),
  };
}
