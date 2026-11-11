import type { ContractCall, WalletSession } from "./types.ts";

/**
 * One `WalletSession` in front of every sign-in method. Screens keep talking to a single session; the router
 * forwards to the method the player chose, remembers that choice, and drops the old session on sign-out or switch
 * so it can never sign again. No wallet library is imported here: each method's opener loads its own.
 */

export type SignInMethod = "email" | "wallet";
export type SessionOpeners = Record<SignInMethod, () => Promise<WalletSession>>;
type MethodStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface RoutedSession extends WalletSession {
  readonly method: SignInMethod | null;
  /** Signs in with `method`, signing the previous method out first when it differs. */
  use(method: SignInMethod): Promise<void>;
  /** Reopens the remembered method without any sign-in window; stays signed out when its session has ended. */
  restore(): Promise<void>;
}

export const SIGN_IN_STORAGE_KEY = "everfolk:sign-in";
/** What a bare `signIn()` uses until the sign-in panel lets the player choose. */
const DEFAULT_METHOD: SignInMethod = "wallet";
const METHODS: readonly SignInMethod[] = ["email", "wallet"];

type TransactionListener = (hash: string, method: string) => void;
interface Active { method: SignInMethod; session: WalletSession; unsubscribe: () => void }

function browserStore(): MethodStore | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

function readMethod(store: MethodStore | null): SignInMethod | null {
  try {
    const value = store?.getItem(SIGN_IN_STORAGE_KEY) ?? null;
    return METHODS.find(method => method === value) ?? null;
  } catch {
    return null;
  }
}

function writeMethod(store: MethodStore | null, method: SignInMethod | null): void {
  try {
    if (method) store?.setItem(SIGN_IN_STORAGE_KEY, method);
    else store?.removeItem(SIGN_IN_STORAGE_KEY);
  } catch { /* storage blocked: the choice simply is not remembered across visits */ }
}

export function createSessionRouter(open: SessionOpeners, store: MethodStore | null = browserStore()): RoutedSession {
  let active: Active | null = null;
  /** Bumps on every sign-out or switch, so a sign-in that finishes afterwards is not installed. */
  let generation = 0;
  const opened = new Map<SignInMethod, Promise<WalletSession>>();
  const listeners = new Set<TransactionListener>();

  const openSession = (method: SignInMethod): Promise<WalletSession> => {
    const cached = opened.get(method);
    if (cached) return cached;
    const request = open[method]();
    opened.set(method, request);
    request.catch(() => { if (opened.get(method) === request) opened.delete(method); });
    return request;
  };

  const install = (method: SignInMethod, session: WalletSession) => {
    const unsubscribe = session.onTransaction?.((hash, name) => { for (const listener of listeners) listener(hash, name); }) ?? (() => {});
    active = { method, session, unsubscribe };
    writeMethod(store, method);
  };

  /** Detaches first, so the old session is unreachable even if its own sign-out fails. */
  const signOut = async () => {
    generation += 1;
    const previous = active;
    active = null;
    writeMethod(store, null);
    if (!previous) return;
    previous.unsubscribe();
    await previous.session.signOut();
  };

  /** A sign-in that finished after a newer sign-in or sign-out must not stay signed in behind the router. */
  const abandon = async (session: WalletSession) => {
    if (active?.session === session) return;
    await session.signOut().catch(error => console.warn("Everfolk: could not sign out a cancelled sign-in.", error));
  };

  const signInWith = async (method: SignInMethod) => {
    if (active?.method === method && active.session.accountId) return;
    if (active) await signOut();
    generation += 1;
    const ticket = generation;
    const session = await openSession(method);
    await session.signIn();
    if (ticket !== generation) {
      await abandon(session);
      throw new Error("Sign-in was cancelled.");
    }
    if (!session.accountId) throw new Error("Sign-in did not finish. Try again.");
    install(method, session);
  };

  let pending: { method: SignInMethod; done: Promise<void> } | null = null;
  /** A second click on the same method joins the sign-in already in progress. */
  const use = (method: SignInMethod): Promise<void> => {
    if (pending?.method === method) return pending.done;
    const done = signInWith(method).finally(() => { if (pending?.done === done) pending = null; });
    pending = { method, done };
    return done;
  };

  const restore = async () => {
    const method = readMethod(store);
    if (!method || active) return;
    const ticket = generation;
    const session = await openSession(method);
    if (ticket !== generation || active) return;
    if (session.accountId) install(method, session);
    else writeMethod(store, null);
  };

  return {
    get method() { return active?.method ?? null; },
    get accountId() { return active?.session.accountId ?? null; },
    get walletId() { return active?.session.walletId ?? null; },
    onTransaction(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    use,
    restore,
    async signIn() { await use(active?.method ?? DEFAULT_METHOD); },
    signOut,
    async call(call: ContractCall) {
      if (!active) throw new Error("Sign in first.");
      return active.session.call(call);
    },
  };
}
