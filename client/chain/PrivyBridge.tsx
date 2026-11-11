import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, useLoginWithEmail, usePrivy, type PrivyProviderProps, type User } from "@privy-io/react-auth";
import { useCreateWallet, useSignRawHash } from "@privy-io/react-auth/extended-chains";
import type { EmailBridge, VerifiedEmail } from "./email-session.ts";

/**
 * Privy behind the `EmailBridge` interface. Loaded with a dynamic import from the email opener, in the browser
 * only, so the worker/SSR bundles and Node tests never import `@privy-io/*`. Privy runs headless in its own React
 * root: email codes via `useLoginWithEmail`, a NEAR embedded key via `useCreateWallet({ chainType: "near" })`,
 * and silent signatures via `useSignRawHash`. `showWalletUIs: false` keeps Privy from opening its own windows.
 */

/** Everything the bridge needs from Privy's hooks, refreshed on every render. */
interface PrivyHooks {
  ready: boolean;
  authenticated: boolean;
  user: User | null;
  getAccessToken(): Promise<string | null>;
  logout(): Promise<void>;
  sendCode(input: { email: string }): Promise<void>;
  loginWithCode(input: { code: string }): Promise<void>;
  createWallet(input: { chainType: "near" }): Promise<{ wallet: { address: string } }>;
  signRawHash(input: { address: string; chainType: "near"; hash: `0x${string}` }): Promise<{ signature: `0x${string}` }>;
}

const READY_TIMEOUT_MS = 15_000;
const USER_TIMEOUT_MS = 15_000;
const NOT_LOADED = "Email sign-in could not load. Check your connection and try again.";
const NO_ACCOUNT = "Your account could not be opened. Please sign in again.";
const NEAR_CHAIN = "near";
/** Headless: email codes only, no Privy windows, and no Ethereum or Solana keys made on the side. */
const PRIVY_CONFIG = {
  loginMethods: ["email"],
  embeddedWallets: { showWalletUIs: false, ethereum: { createOnLogin: "off" }, solana: { createOnLogin: "off" } },
} satisfies NonNullable<PrivyProviderProps["config"]>;

type Waiter = { test(hooks: PrivyHooks): boolean; resolve(hooks: PrivyHooks): void };

/** Holds the latest hook values and resolves waiters as Privy's state changes. */
function createHookStore() {
  let latest: PrivyHooks | null = null;
  let waiters: readonly Waiter[] = [];
  return {
    update(hooks: PrivyHooks) {
      latest = hooks;
      const done = waiters.filter(waiter => waiter.test(hooks));
      waiters = waiters.filter(waiter => !done.includes(waiter));
      for (const waiter of done) waiter.resolve(hooks);
    },
    when(test: (hooks: PrivyHooks) => boolean, timeoutMs: number, message: string): Promise<PrivyHooks> {
      if (latest && test(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const waiter: Waiter = { test, resolve: hooks => { clearTimeout(timer); resolve(hooks); } };
        const timer = setTimeout(() => { waiters = waiters.filter(item => item !== waiter); reject(new Error(message)); }, timeoutMs);
        waiters = [...waiters, waiter];
      });
    },
  };
}
type HookStore = ReturnType<typeof createHookStore>;

function Adapter({ store }: { store: HookStore }) {
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current.update({ ready, authenticated, user, getAccessToken, logout, sendCode, loginWithCode, createWallet, signRawHash });
  }, [ready, authenticated, user, getAccessToken, logout, sendCode, loginWithCode, createWallet, signRawHash]);
  return null;
}

function nearAddress(user: User | null): string | null {
  const account = user?.linkedAccounts.find(linked => linked.type === "wallet" && linked.chainType === NEAR_CHAIN);
  return account && account.type === "wallet" ? account.address : null;
}

function createBridge(store: HookStore): EmailBridge {
  let address: string | null = null;
  let typedEmail = "";
  const ready = () => store.when(hooks => hooks.ready, READY_TIMEOUT_MS, NOT_LOADED);

  /** Reuses the player's NEAR key when Privy already holds one; creates it on first sign-in. */
  const openAccount = async (hooks: PrivyHooks, fallbackEmail: string): Promise<VerifiedEmail> => {
    const existing = nearAddress(hooks.user);
    const created = existing ? null : await hooks.createWallet({ chainType: NEAR_CHAIN });
    const publicKeyHex = existing ?? created?.wallet.address ?? null;
    const accessToken = await hooks.getAccessToken();
    if (!publicKeyHex || !accessToken) throw new Error(NO_ACCOUNT);
    address = publicKeyHex;
    return { publicKeyHex, accessToken, email: hooks.user?.email?.address ?? fallbackEmail };
  };

  return {
    async login(email) {
      typedEmail = email;
      const hooks = await ready();
      // A player Privy still remembers is replaced by the one now signing in.
      if (hooks.authenticated) {
        address = null;
        await hooks.logout();
        await store.when(state => !state.authenticated, USER_TIMEOUT_MS, NOT_LOADED);
      }
      await (await ready()).sendCode({ email });
    },
    async verify(code) {
      await (await ready()).loginWithCode({ code });
      const hooks = await store.when(state => state.authenticated && state.user !== null, USER_TIMEOUT_MS, NO_ACCOUNT);
      return openAccount(hooks, typedEmail);
    },
    async restore() {
      const hooks = await ready();
      return hooks.authenticated && hooks.user ? openAccount(hooks, "") : null;
    },
    async signHash(hash) {
      const hooks = await ready();
      if (!address || !hooks.authenticated) throw new Error(NO_ACCOUNT);
      const { signature } = await hooks.signRawHash({ address, chainType: NEAR_CHAIN, hash: hash as `0x${string}` });
      return signature;
    },
    async logout() {
      address = null;
      await (await ready()).logout();
    },
  };
}

let mounted: Promise<EmailBridge> | null = null;

/** Mounts Privy once per page in a hidden root and resolves to its bridge. Browser only. */
export function mountPrivyBridge(appId: string, doc: Document = document): Promise<EmailBridge> {
  mounted ??= Promise.resolve().then(() => {
    const store = createHookStore();
    const host = doc.createElement("div");
    host.className = "everfolk-privy-root";
    doc.body.appendChild(host);
    createRoot(host).render(
      <PrivyProvider appId={appId} config={PRIVY_CONFIG}>
        <Adapter store={store} />
      </PrivyProvider>,
    );
    return createBridge(store);
  });
  return mounted;
}
