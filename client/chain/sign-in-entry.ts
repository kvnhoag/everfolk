import type { SignInControls } from "./chain-backend.ts";

/**
 * The "sign in" button on screens that need an account (Market, a token page, My lives). With sign-in available
 * it opens the shared sign-in panel under neutral copy; without it, it keeps the old wallet button.
 */
export interface SignInEntry { label: string; onConnect(): void }

export function signInEntry(
  signin: SignInControls | undefined,
  labels: { signIn: string; wallet: string },
  handlers: { openPanel(): void; connectWallet(): void },
): SignInEntry {
  return signin ? { label: labels.signIn, onConnect: handlers.openPanel } : { label: labels.wallet, onConnect: handlers.connectWallet };
}
