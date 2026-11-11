/**
 * The NEAR wallet session the ranked screens sign with. The implementation lives in `near-connect-session.ts`
 * (NEAR Connect plus a popup-free play key); this module keeps the import path stable for callers.
 */
export { createWalletSession } from "./near-connect-session.ts";
