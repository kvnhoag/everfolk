import type { ChainConfig } from "./config.ts";
import { createEmailSession, type EmailSession } from "./email-session.ts";
import { EMAIL_NOT_LOADED } from "./sign-in-errors.ts";

/**
 * Browser glue for the email sign-in method: mounts the Privy bridge and the spend sheet, then picks up a player
 * Privy still remembers. Imported dynamically by `chain-backend.ts` on first use, never by the worker or tests.
 */
export async function openEmailSession(cfg: ChainConfig, privyAppId: string): Promise<EmailSession> {
  if (typeof window === "undefined") throw new Error("Email sign-in is only available in the browser.");
  const [{ mountPrivyBridge }, { mountConfirmSpend }] = await Promise.all([import("./PrivyBridge.tsx"), import("./ConfirmSpend.tsx")])
    .catch(error => {
      console.warn("Everfolk: email sign-in did not load.", error);
      throw new Error(EMAIL_NOT_LOADED);
    });
  const bridge = await mountPrivyBridge(privyAppId);
  const session = createEmailSession(cfg, bridge, { fetch: (input, init) => fetch(input, init), confirm: mountConfirmSpend() });
  await session.restore().catch(error => console.warn("Everfolk: the remembered email sign-in could not be restored.", error));
  return session;
}
